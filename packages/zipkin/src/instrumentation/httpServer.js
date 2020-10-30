const Annotation = require('../annotation');
const InetAddress = require('../InetAddress');
const parseRequestUrl = require('../parseUrl');

function requiredArg(name) {
  throw new Error(`HttpServerInstrumentation: Missing required argument ${name}.`);
}

class HttpServerInstrumentation {
  constructor({
    tracer = requiredArg('tracer'),
    serviceName = tracer.localEndpoint.serviceName,
    host,
    port = requiredArg('port')
  }) {
    this.tracer = tracer;
    this.serviceName = serviceName;
    this.host = host && new InetAddress(host);
    this.port = port;
  }

  spanNameFromRoute(method, route, code) { // eslint-disable-line class-methods-use-this
    if (code > 299 && code < 400) return `${method} redirected`;
    if (code === 404) return `${method} not_found`;
    if (!route || route === '') return method;
    return `${method} ${route}`;
  }

  recordRequest(method, requestUrl, readHeader) {
    this.tracer.extractId(readHeader);
    const {id} = this.tracer;
    const {path} = parseRequestUrl(requestUrl);

    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(method.toUpperCase());
    this.tracer.recordBinary('http.path', path);

    this.tracer.recordAnnotation(new Annotation.ServerRecv());
    this.tracer.recordAnnotation(new Annotation.LocalAddr({host: this.host, port: this.port}));

    return id;
  }

  recordResponse(id, statusCode, error) {
    this.tracer.setId(id);
    this.tracer.recordBinary('http.status_code', statusCode.toString());
    if (error) {
      this.tracer.recordBinary('error', error.toString());
    } else if (statusCode < 200 || statusCode > 399) {
      this.tracer.recordBinary('error', statusCode.toString());
    }
    this.tracer.recordAnnotation(new Annotation.ServerSend());
  }
}

module.exports = HttpServerInstrumentation;
