const config = require('twiage-config');
const winston = require('winston');
const stackTrace = require('stack-trace');
const path = require('path');
const cls = require('continuation-local-storage');

function getTransports() {
  const transportModules = config.get('twiage:logging:transports');
  return transportModules.map((transportModule) => {
    let Transport;
    if (transportModule.type) {
      Transport = winston.transports[transportModule.type];
    } else if (transportModule.module) {
      Transport = require(transportModule.module);
    }
    return new Transport(transportModule.opts);
  });
}

function findCaller() {
  const caller = stackTrace.get()[6];

  const file = path.relative(process.cwd(), caller.getFileName());
  const line = caller.getLineNumber();
  const column = caller.getColumnNumber();

  return `${file}#${line}:${column}`;
}

class TwiageLogger extends winston.Logger {
  constructor() {
    super({
      exitOnError: config.get('twiage:logging:exitOnError') || false,
      transports: getTransports()
    });

    this.rewriters.push((level, msg, meta) => {
      const namespace = cls.getNamespace(config.get('twiage:logging:namespace'));
      const request = namespace.get('request');
      const uuid = namespace.get('uuid');
      const metaFromConf = config.get('twiage:logging:meta');

      if (uuid) {
        meta.uuid = uuid;
      }

      if (meta != null && typeof meta === 'object') {
        meta.caller = findCaller();
      }

      if (request) {
        const headers = config.get('twiage:logging:headers');
        headers.forEach((header) => {
          const value = request.headers[header];
          if (value) {
            meta[header] = value;
          }
        });
      }

      if (meta.stack) {
        meta.stacktrace = meta.stack;
      }

      return Object.assign(metaFromConf, meta);
    });

    this.filters.push((level, msg, meta) => {
      const trace = meta.stacktrace;
      if (trace) {
        delete meta.stacktrace;
        return {
          msg: trace,
          meta
        };
      }
      return msg;
    });
  }

  stream(meta) {
    return {
      write: (message) => {
        this.info(message, meta);
      }
    };
  }
}

module.exports = new TwiageLogger();
