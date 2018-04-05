'use strict';

const globalRequestLogger = require('global-request-logger');
const logger = require('./logger');

module.exports = class GlobalRequestLogger {
  static initialize() {
    globalRequestLogger.initialize();
    globalRequestLogger.on('success', this.successCallback);
    globalRequestLogger.on('error', this.errorCallback);
  }
  static successCallback(request) {
    logger.info('Request', request);
  }
  static errorCallback(request) {
    logger.error('Request', request);
  }
};
