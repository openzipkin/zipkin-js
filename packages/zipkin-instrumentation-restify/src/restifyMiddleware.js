const {
  option: {Some, None},
  Instrumentation
} = require('zipkin');
const url = require('url');
const LOWER_LIMIT = 200;
const UPPER_LIMIT = 399;

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

module.exports = function restifyMiddleware({tracer, serviceName, port = 0}) {
  return function zipkinRestifyMiddleware(req, res, next) {
    const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});
    const readHeader = headerOption.bind(null, req);
    tracer.scoped(() => {
      const id =
        instrumentation.recordRequest(req.method, formatRequestUrl(req), readHeader);

      const onCloseOrFinish = () => {
        res.removeListener('close', onCloseOrFinish);
        res.removeListener('finish', onCloseOrFinish);

        tracer.scoped(() => {
          const error =
            res.statusCode !== 0 && (res.statusCode < LOWER_LIMIT || res.statusCode > UPPER_LIMIT)
            ? res.statusCode
            : null;

          instrumentation.recordResponse(id, res.statusCode, error);
        });
      };

      res.once('close', onCloseOrFinish);
      res.once('finish', onCloseOrFinish);

      next();
    });
  };
};
