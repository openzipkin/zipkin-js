const {
  Annotation,
  HttpHeaders: Header,
  option: {Some, None},
  Instrumentation
} = require('zipkin');
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
    pathname: request.path()
  });
}

module.exports = function restifyMiddleware({tracer, serviceName = 'unknown', port = 0}) {
  return function zipkinRestifyMiddleware(req, res, next) {
    const instrumentation = new Instrumentation.HttpServer({ tracer });
    const readHeader = headerOption.bind(null, req);
    tracer.scoped(() => {
      const id = instrumentation.recordRequest(serviceName, port, req.method, formatRequestUrl(req), readHeader);

      const onCloseOrFinish = () => {
        res.removeListener('close', onCloseOrFinish);
        res.removeListener('finish', onCloseOrFinish);

        tracer.scoped(() => {
          instrumentation.recordResponse(id, res.statusCode);
        });
      };

      res.once('close', onCloseOrFinish);
      res.once('finish', onCloseOrFinish);

      next();
    });
  };
};
