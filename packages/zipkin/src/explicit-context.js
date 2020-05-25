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
      const ctx = this.getContext();

      this.setContext(ctx);
    }
  }

  letContext(ctx, callable) {
    return this.scoped(() => {
      this.setContext(ctx);
      return callable();
    });
  }
};
