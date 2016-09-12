const {
  Annotation,
  HttpHeaders: Header,
  option: {Some, None},
  TraceId
} = require('zipkin');
const url = require('url');

function containsRequiredHeaders(req) {
  return req.header(Header.TraceId) !== undefined &&
    req.header(Header.SpanId) !== undefined;
}

function stringToBoolean(str) {
  return str === '1';
}

function stringToIntOption(str) {
  try {
    return new Some(parseInt(str));
  } catch (err) {
    return None;
  }
}

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

      if (containsRequiredHeaders(req)) {
        const spanId = readHeader(Header.SpanId);
        spanId.ifPresent(sid => {
          const traceId = readHeader(Header.TraceId);
          const parentSpanId = readHeader(Header.ParentSpanId);
          const sampled = readHeader(Header.Sampled);
          const flags = readHeader(Header.Flags).flatMap(stringToIntOption).getOrElse(0);
          const id = new TraceId({
            traceId,
            parentId: parentSpanId,
            spanId: sid,
            sampled: sampled.map(stringToBoolean),
            flags
          });
          tracer.setId(id);
        });
      } else {
        tracer.setId(tracer.createRootId());
        if (req.header(Header.Flags)) {
          const currentId = tracer.id;
          const idWithFlags = new TraceId({
            traceId: currentId.traceId,
            parentId: currentId.parentId,
            spanId: currentId.spanId,
            sampled: currentId.sampled,
            flags: readHeader(Header.Flags)
          });
          tracer.setId(idWithFlags);
        }
      }

      const id = tracer.id;

      tracer.recordServiceName(serviceName);
      tracer.recordRpc(req.method);
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
