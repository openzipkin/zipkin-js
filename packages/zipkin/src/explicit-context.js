// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

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
    const prevCtx = this.getContext();
    try {
      return callable();
    } finally {
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
