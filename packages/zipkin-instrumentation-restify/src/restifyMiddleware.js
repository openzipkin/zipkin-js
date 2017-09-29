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

module.exports = function restifyMiddleware({tracer, serviceName = 'unknown', port = 0}) {
  return function zipkinRestifyMiddleware(req, res, next) {
    const readHeader = headerOption.bind(null, req);
    tracer.scoped(() => {
      Instrumentation.Http.createIdFromHeaders(tracer, readHeader).ifPresent(id => tracer.setId(id));
      const id = tracer.id;

      tracer.recordServiceName(serviceName);
      tracer.recordRpc(req.method);
      tracer.recordBinary('http.url', url.format({
        protocol: req.isSecure() ? 'https' : 'http',
        host: req.header('host'),
        pathname: req.path()
      }));
      tracer.recordAnnotation(new Annotation.ServerRecv());
      tracer.recordAnnotation(new Annotation.LocalAddr({port}));

      if (id.flags !== 0 && id.flags != null) {
        tracer.recordBinary(Header.Flags, id.flags.toString());
      }

      const onCloseOrFinish = () => {
        res.removeListener('close', onCloseOrFinish);
        res.removeListener('finish', onCloseOrFinish);

        tracer.scoped(() => {
          tracer.setId(id);
          tracer.recordBinary('http.status_code', res.statusCode.toString());
          tracer.recordAnnotation(new Annotation.ServerSend());
        });
      };

      res.once('close', onCloseOrFinish);
      res.once('finish', onCloseOrFinish);

      next();
    });
  };
};
