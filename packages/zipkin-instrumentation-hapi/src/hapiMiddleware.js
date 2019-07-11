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

exports.register = (server, {tracer, serviceName, port = 0}) => {
  const instrumentation = new Instrumentation.HttpServer({tracer, serviceName, port});
  const sentinelTraceId = tracer.id;
  if (tracer == null) {
    throw new Error('No tracer specified');
  }

  server.ext('onRequest', (request, reply) => {
    const {headers} = request;
    const readHeader = headerOption.bind(null, headers);
    const {plugins} = request;

    tracer.setId(sentinelTraceId); // In case an abandoned request leaked a trace ID, reset.

    // Here, we intentionally do not scope as we need the handler to see the trace ID. We will clear
    // this `onPreResponse` and in worst case when we loop to `onRequest` again
    const id = instrumentation.recordRequest(request.method, url.format(request.url), readHeader);

    plugins.zipkin = {
      traceId: id
    };
    return reply.continue;
  });

  server.ext('onPreResponse', (request, reply) => {
    tracer.setId(sentinelTraceId); // clear the scope we set `onRequest`

    const {traceId} = request.plugins.zipkin;
    if (!traceId) return reply.continue; // TODO: make a realistic test that could skip this

    const {response} = request;
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

    tracer.scoped(() => instrumentation.recordResponse(traceId, statusCode));

    return reply.continue;
  });
};

exports.name = 'zipkin-instrumentation-hapi';
exports.pkg = pkg;
