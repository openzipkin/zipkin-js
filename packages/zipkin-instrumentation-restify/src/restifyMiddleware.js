const {option: {Some, None}, Instrumentation} = require('zipkin');
const url = require('url');

function headerOption(req, header) {
  const val = req.header(header);
  if (val != null) {
    return new Some(val);
  } else {
    return None;
  }
}

function formatRequestUrl(request) {
  return url.format({
    protocol: request.isSecure() ? 'https' : 'http',
    host: request.header('host'),
    pathname: request.path(),
    search: request.getQuery()
  });
}

module.exports = function restifyMiddleware({tracer, serviceName, port = 0}) {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});

  return function zipkinRestifyMiddleware(req, res, next) {
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
