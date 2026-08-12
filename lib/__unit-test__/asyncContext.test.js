const {EventEmitter} = require('events');
const asyncContext = require('../asyncContext');

describe('asyncContext', () => {
  test('getNamespace returns the same instance created by createNamespace', () => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-identity');

    // Act
    const actual = asyncContext.getNamespace('ns-identity');

    // Assert
    expect(actual).toBe(namespace);
  });

  test('getNamespace returns undefined for a name that was never created', () => {
    // Act
    const actual = asyncContext.getNamespace('ns-never-created');

    // Assert
    expect(actual).toBeUndefined();
  });

  test('set/get inside run() store and retrieve a value', () => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-set-get');
    let actual;

    // Act
    namespace.run(() => {
      namespace.set('key', 'value');
      actual = namespace.get('key');
    });

    // Assert
    expect(actual).toBe('value');
  });

  test('get() outside any run() returns undefined', () => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-outside-get');

    // Act
    const actual = namespace.get('key');

    // Assert
    expect(actual).toBeUndefined();
  });

  test('set() outside any run() does not throw and does not leak into a later run()', () => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-outside-set');

    // Act
    const setReturnValue = namespace.set('key', 'value');
    let actualInsideLaterRun;
    namespace.run(() => {
      actualInsideLaterRun = namespace.get('key');
    });

    // Assert
    expect(setReturnValue).toBe('value');
    expect(actualInsideLaterRun).toBeUndefined();
  });

  test('two concurrent run() calls keep their values isolated from each other', async () => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-concurrency');

    function capture(value, delayMs) {
      return namespace.run(async() => {
        namespace.set('value', value);
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });
        return namespace.get('value');
      });
    }

    // Act
    const [slowResult, fastResult] = await Promise.all([
      capture('slow', 30),
      capture('fast', 5)
    ]);

    // Assert
    expect(slowResult).toBe('slow');
    expect(fastResult).toBe('fast');
  });

  test('bindEmitter lets a listener added inside run() observe the run() value from an emit that happens after run() returns', (done) => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-bind-emitter');
    const emitter = new EventEmitter();
    let capturedInsideListener;

    namespace.run(() => {
      namespace.bindEmitter(emitter);
      namespace.set('token', 'abc123');
      emitter.on('data', () => {
        capturedInsideListener = namespace.get('token');
      });
    });

    // Act: run() has already returned, so there is no active context here
    const capturedAfterRunReturns = namespace.get('token');

    setImmediate(() => {
      emitter.emit('data');

      // Assert
      expect(capturedAfterRunReturns).toBeUndefined();
      expect(capturedInsideListener).toBe('abc123');
      done();
    });
  });

  test('a listener added without bindEmitter does not observe the run() value once run() has returned', (done) => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-no-bind-emitter');
    const emitter = new EventEmitter();
    let capturedInsideListener = 'unset';

    namespace.run(() => {
      namespace.set('token', 'abc123');
      emitter.on('data', () => {
        capturedInsideListener = namespace.get('token');
      });
    });

    // Act
    setImmediate(() => {
      emitter.emit('data');

      // Assert
      expect(capturedInsideListener).toBeUndefined();
      done();
    });
  });

  test('bindEmitter is idempotent: binding twice still invokes a listener exactly once per emit', () => {
    // Arrange
    const namespace = asyncContext.createNamespace('ns-bind-idempotent');
    const emitter = new EventEmitter();
    let callCount = 0;

    namespace.run(() => {
      namespace.bindEmitter(emitter);
      namespace.bindEmitter(emitter);
      emitter.on('data', () => {
        callCount += 1;
      });
    });

    // Act
    emitter.emit('data');

    // Assert
    expect(callCount).toBe(1);
  });
});
