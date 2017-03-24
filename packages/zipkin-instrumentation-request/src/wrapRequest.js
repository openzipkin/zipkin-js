const {Request, Annotation} = require('zipkin');

function wrapRequest(request, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return request.defaults((options, callback) => {
    tracer.scoped(() => {
      tracer.setId(tracer.createChildId());
      const traceId = tracer.id;

      const wrappedOptions = Request.addZipkinHeaders(options, tracer.id);
      tracer.recordServiceName(serviceName);
      const method = wrappedOptions.method || 'GET';
      tracer.recordRpc(method.toUpperCase());
      tracer.recordBinary('http.url', wrappedOptions.uri || wrappedOptions.url);
      tracer.recordAnnotation(new Annotation.ClientSend());
      if (remoteServiceName) {
        tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: remoteServiceName
        }));
      }

      const wrappedCallback = (error, response, body) => {
        tracer.setId(traceId);
        tracer.recordBinary('http.status_code', response.statusCode.toString());
        tracer.recordAnnotation(new Annotation.ClientRecv());
        return callback(error, response, body);
      };

      request(wrappedOptions, wrappedCallback);
    });
  });
}

module.exports = wrapRequest;
