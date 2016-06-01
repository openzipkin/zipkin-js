const {createNamespace, getNamespace} = require('continuation-local-storage');

module.exports = class CLSContext {
  constructor(namespace = 'zipkin') {
    this._session = getNamespace(namespace) || createNamespace(namespace);
    const defaultContext = this._session.createContext();
    this._session.enter(defaultContext);
  }

  getContext() {
    const currentCtx = this._session.get('zipkin');
    if (currentCtx != null) {
      return currentCtx;
    } else {
      return null; // explicitly return null (not undefined)
    }
  }

  letContext(ctx, callable) {
    let result;
    this._session.run(() => {
      this._session.set('zipkin', ctx);
      result = callable();
    });
    return result;
  }
};
