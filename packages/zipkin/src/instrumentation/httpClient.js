const Annotation = require('../annotation');
const Request = require('../request');
const parseRequestUrl = require('../parseUrl');

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
    const {path} = parseRequestUrl(url);

    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(method.toUpperCase());
    this.tracer.recordBinary('http.path', path);

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
    if (statusCode < 200 || statusCode > 399) {
      this.tracer.recordBinary('error', statusCode.toString());
    }
    this.tracer.recordAnnotation(new Annotation.ClientRecv());
  }

  recordError(traceId, error) {
    this.tracer.setId(traceId);
    this.tracer.recordBinary('error', error.toString());
    this.tracer.recordAnnotation(new Annotation.ClientRecv());
  }
}

module.exports = HttpClientInstrumentation;
