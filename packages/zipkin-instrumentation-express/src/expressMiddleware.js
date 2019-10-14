const {option: {Some, None}, Instrumentation} = require('zipkin');
const url = require('url');

/**
 * @private
 * @param {http.IncomingMessage} req
 * @return {string}
 */
function formatRequestUrl(req) {
  const parsed = url.parse(req.originalUrl);
  return url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: parsed.pathname,
    search: parsed.search
  });
}

/**
 * @typedef {Object} MiddlewareOptions
 * @property {Object} tracer
 * @property {string} serviceName
 * @property {number} port
 */

/**
 * @param {MiddlewareOptions}
 * @return {ZipkinMiddleware}
 */
module.exports = function expressMiddleware({tracer, serviceName, port = 0}) {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});

  /**
   * @method
   * @typedef {function} ZipkinMiddleware
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {function()} next
   */
  return function zipkinExpressMiddleware(req, res, next) {
    function readHeader(header) {
      const val = req.header(header);
      if (val != null) {
        return new Some(val);
      } else {
        return None;
      }
    }

    tracer.scoped(() => {
      const id = instrumentation.recordRequest(req.method, formatRequestUrl(req), readHeader);

      Object.defineProperty(req, '_trace_id', {configurable: false, get: () => id});

      /**
       * records response on finish or close (whichever happens first)
       * @listens close
       * @listens finish
       */
      const onCloseOrFinish = () => {
        res.removeListener('close', onCloseOrFinish);
        res.removeListener('finish', onCloseOrFinish);

        tracer.letId(id, () => {
          // if route is terminated on middleware req.route won't be available
          const route = req.route && req.route.path;
          tracer.recordRpc(instrumentation.spanNameFromRoute(req.method, route, res.statusCode));
          instrumentation.recordResponse(id, res.statusCode);
        });
      };

      res.once('close', onCloseOrFinish);
      res.once('finish', onCloseOrFinish);

      next();
    }); // don't leak the trace ID from recordRequest
  };
};
