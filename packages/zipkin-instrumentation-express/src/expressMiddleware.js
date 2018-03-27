const {
  option: {Some, None},
  Instrumentation
} = require('zipkin');
const url = require('url');

function formatRequestUrl(req) {
  const parsed = url.parse(req.originalUrl);
  return url.format({
    protocol: req.protocol,
    host: req.get('host'),
    pathname: parsed.pathname,
    search: parsed.search
  });
}

module.exports = function expressMiddleware({tracer, serviceName, port = 0}) {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});
  return function zipkinExpressMiddleware(req, res, next) {
    tracer.scoped(() => {
      function readHeader(header) {
        const val = req.header(header);
        if (val != null) {
          return new Some(val);
        } else {
          return None;
        }
      }

      const name = req.method + ' ' + req.route.path;
      const id =
        instrumentation.recordRequest(name, formatRequestUrl(req), readHeader);

      res.on('finish', () => {
        tracer.scoped(() => {
          instrumentation.recordResponse(id, res.statusCode);
        });
      });

      next();
    });
  };
};
