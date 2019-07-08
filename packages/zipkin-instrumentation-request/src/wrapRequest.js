const {
  Instrumentation
} = require('zipkin');

function wrapRequest(request, {tracer, serviceName, remoteServiceName}) {
  const instrumentation = new Instrumentation.HttpClient({tracer, serviceName, remoteServiceName});
  return request.defaults((options, callback) => tracer.scoped(() => {
    const method = options.method || 'GET';
    const url = options.uri || options.url;
    const wrappedOptions = instrumentation.recordRequest(options, url, method);
    const traceId = tracer.id;

    const recordResponse = (response) => {
      tracer.scoped(() => {
        instrumentation.recordResponse(traceId, response.statusCode);
      });
    };

    const recordError = (error) => {
      tracer.scoped(() => {
        instrumentation.recordError(traceId, error);
      });
    };

    return request(wrappedOptions, callback)
      .on('response', recordResponse)
      .on('error', recordError);
  }));
}

module.exports = wrapRequest;
