const {option: {Some, None}, Instrumentation} = require('zipkin');

module.exports = function zipkinMiddleware({tracer, serviceName, port = 0}) {
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
    tracer.scoped(() => {
      const method = ctx.request.method.toUpperCase();
      const id = instrumentation.recordRequest(method, ctx.request.href, readHeader);

      const recordResponse = () => {
        tracer.scoped(() => instrumentation.recordResponse(id, ctx.status));
      };

      next()
        .then(recordResponse)
        .catch(recordResponse);
    });
  };
};
