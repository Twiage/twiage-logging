# twiage-logging

Twiage wrapper around winston for async logging in javascript projects.

## API

If you use _twiage-logging_ without _twiage-server_ you have to add the logging middleware to your express app on your own.

    const LoggingMiddleware = require('twiage-logging').Middleware;

    app.use(LoggingMiddleware.spy);

To log something simply require the logger.

    const logger = require('twiage-logging').logger;

    logger.info('This is an info.');
    logger.warn('This is a warning.');
    logger.error('This is an error.');

You can also use morgan as an accessLog. Simple set the morgan outputStream to our twiage-logging.logger.stream.
You can provide a meta object that will be logged with the accessLogMessage.

    const morgan = require('morgan');
    const logger = require('twiage-logging').logger;

    app.use(morgan('combined', {stream: logger.stream([meta])}));

### Config

- twiage:logging:namespace - The logging namespace. (default: "twiage-logging")
- twiage:logging:exitOnError - Should the process exit when an error is logged. (default: true)
- twiage:logging:transports - List of winston transports with their type and options. (default: "Console")
- twiage:logging:meta (optional) - Object of additional key-value pairs for each log entry.
- twiage:logging:headers (optional) - List of HTTP headers which values should be logged with each log entry.
