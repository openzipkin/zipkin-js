const {option: {Some, None}, Instrumentation} = require('zipkin');

module.exports = function zipkinMiddleware({tracer, serviceName = 'unknown', port = 0}) {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});

  return async function zipkinKoaMiddleware(ctx, next) {
    function readHeader(header) {
      const val = ctx.request.headers[header.toLowerCase()];
      if (val != null) {
        return new Some(val);
      } else {
        return None;
      }
    }
    tracer.scoped(async() => {
      const method = ctx.request.method.toUpperCase();
      const id = instrumentation.recordRequest(method, ctx.request.href, readHeader);

      try {
        await next();
      } finally {
        tracer.scoped(() => {
          instrumentation.recordResponse(id, ctx.status);
        });
      }
    });
  };
};
