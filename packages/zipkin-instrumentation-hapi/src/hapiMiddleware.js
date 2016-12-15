const {
  Annotation,
  HttpHeaders: Header,
  TraceId,
  option: {Some, None}
} = require('zipkin');
const url = require('url');
const pkg = require('../package.json');

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

function headerOption(headers, header) {
  const val = headers[header.toLowerCase()];
  if (val != null) {
    return new Some(val);
  } else {
    return None;
  }
}

exports.register = (server, {tracer, serviceName = 'unknown', port = 0}, next) => {
  if (tracer == null) {
    next(new Error('No tracer specified'));
    return;
  }

  server.ext('onRequest', (request, reply) => {
    const {headers} = request;
    const readHeader = headerOption.bind(null, headers);
    const plugins = request.plugins;

    tracer.scoped(() => {
      if (readHeader(Header.TraceId) !== None && readHeader(Header.SpanId) !== None) {
        const spanId = readHeader(Header.SpanId);
        spanId.ifPresent((sid) => {
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
        if (readHeader(Header.Flags) !== None) {
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

      plugins.zipkin = {
        traceId: tracer.id
      };

      tracer.recordServiceName(serviceName);
      tracer.recordRpc(request.method.toUpperCase());
      tracer.recordBinary('http.url', url.format(request.url));
      tracer.recordAnnotation(new Annotation.ServerRecv());
      tracer.recordAnnotation(new Annotation.LocalAddr({port}));

      if (id.flags !== 0 && id.flags != null) {
        tracer.recordBinary(Header.Flags, id.flags.toString());
      }

      return reply.continue();
    });
  });

  server.ext('onPreResponse', (request, reply) => {
    const {response} = request;

    tracer.scoped(() => {
      tracer.setId(request.plugins.zipkin.traceId);
      tracer.recordBinary('http.status_code', response.statusCode.toString());
      tracer.recordAnnotation(new Annotation.ServerSend());
    });

    return reply.continue();
  });

  next();
};

exports.register.attributes = {pkg};
