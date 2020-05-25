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
    try {
      return callable();
    } finally {
      const prevCtx = this.getContext();

      this.setContext(prevCtx);
    }
  }

  letContext(ctx, callable) {
    return this.scoped(() => {
      this.setContext(ctx);
      return callable();
    });
  }
};
