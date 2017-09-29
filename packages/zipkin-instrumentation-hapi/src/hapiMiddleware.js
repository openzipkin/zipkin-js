const {
  Annotation,
  HttpHeaders: Header,
  option: {Some, None},
  Instrumentation
} = require('zipkin');
const url = require('url');
const pkg = require('../package.json');

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
      Instrumentation.Http.createIdFromHeaders(tracer, readHeader).ifPresent(id => tracer.setId(id));
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
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

    tracer.scoped(() => {
      tracer.setId(request.plugins.zipkin.traceId);
      tracer.recordBinary('http.status_code', statusCode.toString());
      tracer.recordAnnotation(new Annotation.ServerSend());
    });

    return reply.continue();
  });

  next();
};

exports.register.attributes = {pkg};
