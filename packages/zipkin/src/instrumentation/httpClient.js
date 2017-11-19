const Annotation = require('../annotation');
const Request = require('../request');

function requiredArg(name) {
  throw new Error(`HttpClientInstrumentation: Missing required argument ${name}.`);
}

class HttpClientInstrumentation {
  constructor({
    tracer = requiredArg('tracer'),
    serviceName = tracer.localEndpoint.serviceName,
    remoteServiceName
  }) {
    this.tracer = tracer;
    this.serviceName = serviceName;
    this.remoteServiceName = remoteServiceName;
  }

  recordRequest(request, url, method) {
    this.tracer.setId(this.tracer.createChildId());
    const traceId = this.tracer.id;

    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(method.toUpperCase());
    this.tracer.recordBinary('http.url', url);
    this.tracer.recordAnnotation(new Annotation.ClientSend());
    if (this.remoteServiceName) {
      // TODO: can we get the host and port of the http connection?
      this.tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: this.remoteServiceName
      }));
    }

    return Request.addZipkinHeaders(request, traceId);
  }

  recordResponse(traceId, statusCode) {
    this.tracer.setId(traceId);
    this.tracer.recordBinary('http.status_code', statusCode.toString());
    this.tracer.recordAnnotation(new Annotation.ClientRecv());
  }

  recordError(traceId, error) {
    this.tracer.setId(traceId);
    this.tracer.recordBinary('error', error.toString());
    this.tracer.recordAnnotation(new Annotation.ClientRecv());
  }
}

module.exports = HttpClientInstrumentation;
