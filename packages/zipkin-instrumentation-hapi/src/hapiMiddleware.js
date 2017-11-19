const {
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

exports.register = (server, {tracer, serviceName, port = 0}, next) => {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});
  if (tracer == null) {
    next(new Error('No tracer specified'));
    return;
  }

  server.ext('onRequest', (request, reply) => {
    const {headers} = request;
    const readHeader = headerOption.bind(null, headers);
    const plugins = request.plugins;

    tracer.scoped(() => {
      const id =
        instrumentation.recordRequest(request.method, url.format(request.url), readHeader);

      plugins.zipkin = {
        traceId: id
      };

      return reply.continue();
    });
  });

  server.ext('onPreResponse', (request, reply) => {
    const {response} = request;
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

    tracer.scoped(() => {
      instrumentation.recordResponse(request.plugins.zipkin.traceId, statusCode);
    });

    return reply.continue();
  });

  next();
};

exports.register.attributes = {pkg};
