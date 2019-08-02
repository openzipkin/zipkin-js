const {option: {Some, None}, Instrumentation} = require('zipkin');

/**
 * @typedef {Object} MiddlewareOptions
 * @property {Object} tracer
 * @property {string} serviceName
 * @property {number} port
 */

/**
 * @param {MiddlewareOptions}
 * @return {ZipkinKoaMiddleware}
 */
module.exports = function koaMiddleware({tracer, serviceName, port = 0}) {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});

  /**
   * @method
   * @typedef {function} ZipkinKoaMiddleware
   * @param {Object} ctx
   * @param {function()} next
   */
  return function zipkinKoaMiddleware(ctx, next) {
    function readHeader(header) {
      const val = ctx.request.headers[header.toLowerCase()];
      if (val != null) {
        return new Some(val);
      } else {
        return None;
      }
    }
    return tracer.scoped(() => {
      const method = ctx.request.method.toUpperCase();
      const id = instrumentation.recordRequest(method, ctx.request.href, readHeader);

      Object.defineProperty(ctx.request, '_trace_id', {configurable: false, get: () => id});

      const recordResponse = () => {
        tracer.letId(id, () => {
          // support koa-route and koa-router
          const matchedPath = ctx.routePath || ctx._matchedRoute;
          tracer.recordRpc(instrumentation.spanNameFromRoute(method, matchedPath, ctx.status));
          instrumentation.recordResponse(id, ctx.status);
        });
      };

      return next()
        .then(recordResponse)
        .catch(recordResponse);
    });
  };
};
