'use strict';

const {AsyncLocalStorage} = require('async_hooks');

const bindableMethods = ['addListener', 'on', 'once'];

class Namespace {
  constructor() {
    this.als = new AsyncLocalStorage();
  }

  run(callback) {
    return this.als.run(new Map(), callback);
  }

  set(key, value) {
    const store = this.als.getStore();
    if (store) {
      store.set(key, value);
    }
    return value;
  }

  get(key) {
    const store = this.als.getStore();
    return store ? store.get(key) : undefined;
  }

  bindEmitter(emitter) {
    const als = this.als;

    bindableMethods.forEach((method) => {
      const original = emitter[method];
      if (typeof original !== 'function' || original.__asyncContextBound) {
        return;
      }

      const bound = function(event, listener) {
        const store = als.getStore();
        const wrapped = store
          ? function(...args) {
            return als.run(store, () => listener.apply(this, args));
          }
          : listener;
        return original.call(this, event, wrapped);
      };
      bound.__asyncContextBound = true;

      emitter[method] = bound;
    });
  }
}

const namespaces = new Map();

function createNamespace(name) {
  const namespace = new Namespace();
  namespaces.set(name, namespace);
  return namespace;
}

function getNamespace(name) {
  return namespaces.get(name);
}

module.exports = {
  createNamespace,
  getNamespace
};
