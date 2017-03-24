const {Request, Annotation} = require('zipkin');

function wrapRequest(request, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return request.defaults((options, callback) => tracer.scoped(() => {
    tracer.setId(tracer.createChildId());
    const traceId = tracer.id;

    const wrappedOptions = Request.addZipkinHeaders(options, tracer.id);
    const method = wrappedOptions.method || 'GET';

    tracer.recordServiceName(serviceName);
    tracer.recordRpc(method.toUpperCase());
    tracer.recordBinary('http.url', wrappedOptions.uri || wrappedOptions.url);
    tracer.recordAnnotation(new Annotation.ClientSend());
    if (remoteServiceName) {
      tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: remoteServiceName
      }));
    }

    const recordResponse = (response) => {
      tracer.setId(traceId);
      tracer.recordBinary('http.status_code', response.statusCode.toString());
      tracer.recordAnnotation(new Annotation.ClientRecv());
    };

    return request(wrappedOptions, callback).on('response', recordResponse);
  }));
}

module.exports = wrapRequest;
