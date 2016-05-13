const {
  trace,
  Annotation,
  HttpHeaders: Header,
  option: {Some, None},
  TraceId
} = require('zipkin-core');
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

module.exports = function expressMiddleware(options) {
  const serviceName = options.serviceName || 'unknown';
  const port = options.port || 0;
  return trace.bindContext(function zipkinExpressMiddleware(req, res, next) {
    trace.withContext(() => {
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
          trace.setId(id);
        });
      } else {
        trace.setId(trace.cleanId());
        if (req.header(Header.Flags)) {
          const currentId = trace.id();
          const idWithFlags = new TraceId({
            traceId: currentId.traceId,
            parentId: currentId.parentId,
            spanId: currentId.spanId,
            sampled: currentId.sampled,
            flags: readHeader(Header.Flags)
          });
          trace.setId(idWithFlags);
        }
      }

      const id = trace.id();

      trace.recordServiceName(serviceName);
      trace.recordRpc(req.method);
      trace.recordBinary('http.url', url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: req.originalUrl
      }));
      trace.recordAnnotation(new Annotation.ServerRecv());
      trace.recordAnnotation(new Annotation.LocalAddr({port}));

      if (id.flags !== 0 && id.flags != null) {
        trace.recordBinary(Header.Flags, id.flags.toString());
      }

      res.on('finish', () => {
        trace.setId(id);
        trace.recordBinary('http.status_code', res.statusCode.toString());
        trace.recordAnnotation(new Annotation.ServerSend());
      });

      next();
    });
  });
};
