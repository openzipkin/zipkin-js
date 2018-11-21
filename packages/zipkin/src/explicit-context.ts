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
    const prevCtx = this.currentCtx;
    const result = callable();
    this.currentCtx = prevCtx;
    return result;
  }

  letContext(ctx, callable) {
    return this.scoped(() => {
      this.setContext(ctx);
      return callable();
    });
  }
};

