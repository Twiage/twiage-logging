const fs = require('fs');
const os = require('os');
const path = require('path');
const winston = require('winston');
const config = require('twiage-config');
const cls = require('../asyncContext');

const namespaceName = 'twiage-logging-test';

// twiage-config's `overrides` store ends up lower-priority than its own
// file stores once loadConfig() has already run once at require-time, so
// config.update() cannot be relied on here. Drive config.get() directly
// with fixed test values instead.
const testConfig = {
  'twiage:logging:namespace': namespaceName,
  'twiage:logging:exitOnError': false,
  'twiage:logging:transports': [{type: 'Console'}],
  'twiage:logging:meta': {service: 'twiage-logging-test'},
  'twiage:logging:headers': ['x-test-header']
};
// The rewriter mutates the object returned for 'twiage:logging:meta'
// (Object.assign(metaFromConf, meta)), so hand back a fresh copy every call.
config.get = (key) => {
  const value = testConfig[key];
  return value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
};

const namespace = cls.createNamespace(namespaceName);
const logger = require('../logger');

const rewriter = logger.rewriters[0];
const filter = logger.filters[0];

describe('logger', () => {
  test('rewriter attaches uuid, caller and configured static meta when there is no active request', () => {
    // Act
    const actual = rewriter('info', 'message', {});

    // Assert
    expect(actual.uuid).toBeUndefined();
    expect(actual.service).toBe('twiage-logging-test');
    expect(actual.caller).toMatch(/#\d+:\d+$/);
  });

  test('rewriter attaches uuid and configured header values from the active request', () => {
    // Arrange
    let actual;

    // Act
    namespace.run(() => {
      namespace.set('uuid', 'uuid-123');
      namespace.set('request', {headers: {'x-test-header': 'header-value', 'x-other': 'ignored'}});
      actual = rewriter('info', 'message', {});
    });

    // Assert
    expect(actual.uuid).toBe('uuid-123');
    expect(actual['x-test-header']).toBe('header-value');
    expect(actual['x-other']).toBeUndefined();
  });

  test('rewriter does not attach a header when the request does not carry it', () => {
    // Arrange
    let actual;

    // Act
    namespace.run(() => {
      namespace.set('request', {headers: {}});
      actual = rewriter('info', 'message', {});
    });

    // Assert
    expect(actual['x-test-header']).toBeUndefined();
  });

  test('rewriter promotes an error stack into meta.stacktrace', () => {
    // Act
    const actual = rewriter('error', 'message', {stack: 'Error: boom\n  at somewhere'});

    // Assert
    expect(actual.stacktrace).toBe('Error: boom\n  at somewhere');
  });

  test('filter replaces the log message with the stacktrace and strips it from meta', () => {
    // Arrange
    const meta = {stacktrace: 'Error: boom\n  at somewhere', caller: 'file#1:1'};

    // Act
    const actual = filter('error', 'original message', meta);

    // Assert
    expect(actual.msg).toBe('Error: boom\n  at somewhere');
    expect(actual.meta.stacktrace).toBeUndefined();
    expect(actual.meta.caller).toBe('file#1:1');
  });

  test('filter returns the original message unchanged when meta has no stacktrace', () => {
    // Arrange
    const meta = {caller: 'file#1:1'};

    // Act
    const actual = filter('info', 'original message', meta);

    // Assert
    expect(actual).toBe('original message');
  });

  test('stream().write logs the given message with the given meta at info level', () => {
    // Arrange
    const infoCalls = [];
    const originalInfo = logger.info;
    logger.info = (...args) => {
      infoCalls.push(args);
    };
    const meta = {source: 'http-access-log'};

    // Act
    logger.stream(meta).write('a request happened');

    // Assert
    logger.info = originalInfo;
    expect(infoCalls).toEqual([['a request happened', meta]]);
  });

  test('logger.info() writes a message that lands on disk with the enriched meta', async() => {
    // Arrange
    const logFile = path.join(os.tmpdir(), `twiage-logging-test-${Date.now()}-${Math.random().toString(36).slice(2)}.log`);
    const fileTransport = new winston.transports.File({filename: logFile, json: true});
    logger.add(fileTransport, {}, true);

    async function readLoggedLine() {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (fs.existsSync(logFile)) {
          const fileContents = fs.readFileSync(logFile, 'utf8').trim();
          if (fileContents) {
            return fileContents.split('\n')[0];
          }
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
      }
      throw new Error(`Timed out waiting for a log line to appear in ${logFile}`);
    }

    // Act
    namespace.run(() => {
      namespace.set('uuid', 'uuid-on-disk');
      logger.info('message written to disk', {});
    });
    const loggedLine = await readLoggedLine();
    const parsed = JSON.parse(loggedLine);

    // Assert
    expect(parsed.message).toBe('message written to disk');
    expect(parsed.uuid).toBe('uuid-on-disk');
    expect(parsed.service).toBe('twiage-logging-test');

    logger.remove(winston.transports.File);
    fs.unlinkSync(logFile);
  });
});
