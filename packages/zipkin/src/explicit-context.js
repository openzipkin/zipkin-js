module.exports = class ExplicitContext {
  constructor() {
    this.currentCtx = null;
  }

  setContext(ctx) {
    this.currentCtx = ctx;
  }

  getContext() {
    return this.currentCtx;
  }

  scoped(callable) {
    callable();
    return this.currentCtx;
  }

  letContext(ctx, callable) {
    return this.scoped(() => {
      this.setContext(ctx);
      return callable();
    });
  }
};

