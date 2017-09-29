const {
  Annotation,
  HttpHeaders: Header,
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

module.exports = function expressMiddleware({tracer, serviceName = 'unknown', port = 0}) {
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

      Instrumentation.Http.createIdFromHeaders(tracer, readHeader).ifPresent(id => tracer.setId(id));
      const id = tracer.id;

      tracer.recordServiceName(serviceName);
      tracer.recordRpc(req.method.toUpperCase());
      tracer.recordBinary('http.url', formatRequestUrl(req));
      tracer.recordAnnotation(new Annotation.ServerRecv());
      tracer.recordAnnotation(new Annotation.LocalAddr({port}));

      if (id.flags !== 0 && id.flags != null) {
        tracer.recordBinary(Header.Flags, id.flags.toString());
      }

      res.on('finish', () => {
        tracer.scoped(() => {
          tracer.setId(id);
          tracer.recordBinary('http.status_code', res.statusCode.toString());
          tracer.recordAnnotation(new Annotation.ServerSend());
        });
      });

      next();
    });
  };
};
