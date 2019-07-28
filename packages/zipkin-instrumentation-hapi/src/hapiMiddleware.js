const {option: {Some, None}, Instrumentation} = require('zipkin');
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
  if (tracer == null) throw new Error('No tracer specified');

  const sentinelTraceId = tracer.id;

  server.ext('onRequest', (request, h) => {
    const {headers} = request;
    const readHeader = headerOption.bind(null, headers);

    const traceId = tracer.scoped(
      () => instrumentation.recordRequest(request.method, url.format(request.url), readHeader)
    );

    Object.defineProperty(request, '_trace_id', {configurable: false, get: () => traceId});
    return h.continue;
  });

  // server.decorate seems a better choice for scoping the handler with the current trace ID
  // However, it seems only one decorator is permitted, and we don't want to break if the user
  // supplied one. Hence, we use handlers instead.
  server.ext('onPreHandler', (request, h) => {
    const traceId = request._trace_id;
    if (traceId) tracer.setId(traceId); // manually start scope
    return h.continue;
  });

  server.ext('onPreResponse', (request, h) => {
    const traceId = request._trace_id;
    if (!traceId) return h.continue; // TODO: make a realistic test that could skip this

    tracer.setId(sentinelTraceId); // stop any scope

    const {response} = request;
    const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

    tracer.scoped(() => instrumentation.recordResponse(traceId, statusCode));

    return h.continue;
  });
};

exports.name = 'zipkin-instrumentation-hapi';
exports.pkg = pkg;
