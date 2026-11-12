// Integration test: the library as a consumer wires it. A real HTTP server runs
// Middleware.spy on every request, handlers log through the real logger, and the
// assertions read what the configured transport actually received. Nothing in
// this library is mocked.
const http = require('http');
const {logger, Middleware} = require('../../index');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const transport = logger.transports.memory;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function entries() {
  return [...transport.writeOutput, ...transport.errorOutput].map((line) => JSON.parse(line));
}

function byMessage(message) {
  return entries().filter((entry) => entry.message === message);
}

// The handler awaits before and after logging so the context has to survive
// timers and promise continuations, and it logs again from the response
// 'finish' listener, which only keeps the context because of bindEmitter.
async function handler(request, response) {
  await delay(Number(request.headers['x-delay-ms'] || 0));
  logger.info('handled request', {route: request.url});
  response.on('finish', () => logger.info('response finished'));
  await Promise.resolve();
  logger.stream({component: 'access'}).write(`${request.method} ${request.url} 200`);
  response.end('ok');
}

let server;
let baseUrl;

beforeAll(async () => {
  server = http.createServer((request, response) => {
    Middleware.spy(request, response, () => {
      handler(request, response).catch((error) => {
        response.statusCode = 500;
        response.end(error.message);
      });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  transport.writeOutput.length = 0;
  transport.errorOutput.length = 0;
});

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, {headers}, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    }).on('error', reject);
  });
}

async function waitForEntries(message, count) {
  for (let i = 0; i < 50 && byMessage(message).length < count; i += 1) {
    await delay(10);
  }
  return byMessage(message);
}

describe('request flow through middleware and logger', () => {
  test('every log line of a request carries its uuid, configured headers and static meta', async () => {
    // Act
    const status = await get('/cases/42', {'x-request-id': 'req-1', 'x-organization-id': 'org-7'});
    const [finished] = await waitForEntries('response finished', 1);

    // Assert
    expect(status).toBe(200);
    const [handled] = byMessage('handled request');
    const [access] = byMessage('GET /cases/42 200');
    for (const entry of [handled, access, finished]) {
      expect(entry.uuid).toMatch(UUID_V4);
      expect(entry['x-request-id']).toBe('req-1');
      expect(entry['x-organization-id']).toBe('org-7');
      expect(entry.service).toBe('twiage-logging-integration');
    }
    expect(new Set([handled.uuid, access.uuid, finished.uuid]).size).toBe(1);
    expect(handled.level).toBe('info');
    expect(handled.route).toBe('/cases/42');
    expect(access.component).toBe('access');
  });

  test('concurrent requests keep their own context', async () => {
    // Act: the first request finishes last, so the two flows interleave.
    await Promise.all([
      get('/a', {'x-request-id': 'slow', 'x-delay-ms': '40'}),
      get('/b', {'x-request-id': 'fast', 'x-delay-ms': '0'})
    ]);
    const finished = await waitForEntries('response finished', 2);

    // Assert
    const handled = byMessage('handled request');
    expect(handled).toHaveLength(2);
    const slow = handled.find((entry) => entry.route === '/a');
    const fast = handled.find((entry) => entry.route === '/b');
    expect(slow['x-request-id']).toBe('slow');
    expect(fast['x-request-id']).toBe('fast');
    expect(slow.uuid).not.toBe(fast.uuid);
    for (const entry of finished) {
      const owner = entry.uuid === slow.uuid ? 'slow' : 'fast';
      expect(entry['x-request-id']).toBe(owner);
    }
  });

  test('the caller points at the code that logged, not at the library', async () => {
    // Act
    await get('/caller', {'x-request-id': 'req-caller'});

    // Assert
    const [handled] = byMessage('handled request');
    expect(handled.caller).toMatch(/^lib\/__integration-test__\/requestFlow\.test\.js#\d+:\d+$/);
  });

  test('a log line outside any request has no request context', () => {
    // Act
    logger.info('startup complete', {phase: 'boot'});

    // Assert
    const [entry] = byMessage('startup complete');
    expect(entry.phase).toBe('boot');
    expect(entry.service).toBe('twiage-logging-integration');
    expect(entry.uuid).toBeUndefined();
    expect(entry['x-request-id']).toBeUndefined();
  });

  test('an error logged with a stack is emitted with the stack trace as its message', () => {
    // Arrange
    const error = new Error('kaboom');

    // Act
    logger.error('request failed', {stack: error.stack});

    // Assert
    const [entry] = entries().filter((line) => line.level === 'error');
    expect(entry.message).toContain('Error: kaboom');
    expect(entry.message).toContain('requestFlow.test.js');
    expect(entry.stack).toBe(error.stack);
    expect(entry.stacktrace).toBeUndefined();
  });
});
