const cls = require('./asyncContext');
const config = require('twiage-config');
const namespace = cls.createNamespace(config.get('twiage:logging:namespace'));
const {randomUUID} = require('crypto');

module.exports = class Middleware {
  static spy(request, response, next) {
    namespace.bindEmitter(request);
    namespace.bindEmitter(response);
    namespace.run(Middleware.getRunCallback(request, response, next));
  }
  static getRunCallback(request, response, next) {
    return () => {
      namespace.set('request', request);
      namespace.set('response', response);
      namespace.set('uuid', randomUUID());
      next();
    };
  }
};
