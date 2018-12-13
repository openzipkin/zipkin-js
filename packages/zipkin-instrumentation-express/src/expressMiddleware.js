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

    const id = instrumentation.recordRequest(req.method, formatRequestUrl(req), readHeader);
    Object.defineProperty(req, '_trace_id', {configurable: false, get: () => id});

    res.on('finish', () => {
      tracer.scoped(() => {
        tracer.setId(id);
        // if route is terminated on middleware req.route won't be available
        if (req.route) {
          tracer.recordRpc(`${req.method} ${req.route.path}`);
        }
        instrumentation.recordResponse(id, res.statusCode);
      });
    });

    next();
  };
};
