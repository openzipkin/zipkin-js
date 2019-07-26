const {option: {Some, None}, Instrumentation} = require('zipkin');
const url = require('url');

/**
 * @param {http.IncomingMessage} req
 * @param {string} header header name
 * @return {zipkin.option.Some|zipkin.option.None}
 */
function headerOption(req, header) {
  const val = req.headers[header.toLowerCase()];
  if (val != null) {
    return new Some(val);
  } else {
    return None;
  }
}

/**
 * @param {http.IncomingMessage} req
 * @return {string}
 */
function formatRequestUrl(req) {
  const parsed = url.parse(req.url);
  return url.format({
    protocol: req.connection.encrypted ? 'https' : 'http',
    host: req.headers.host,
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
module.exports = function middleware({tracer, serviceName, port = 0}) {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});

  /**
   * @method
   * @typedef {function} ZipkinMiddleware
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   * @param {function()} next
   */
  return function zipkinMiddleware(req, res, next) {
    const readHeader = header => headerOption(req, header);

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
        tracer.scoped(() => instrumentation.recordResponse(id, res.statusCode));
      };

      res.once('close', onCloseOrFinish);
      res.once('finish', onCloseOrFinish);

      next();
    });
  };
};
