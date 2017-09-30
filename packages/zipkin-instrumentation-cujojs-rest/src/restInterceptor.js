/* eslint-disable no-param-reassign */
const interceptor = require('rest/interceptor');
const {
  Annotation,
  Request,
  InetAddress
  } = require('zipkin');

function getRequestMethod(req) {
  let method = 'get';
  if (req.entity) {
    method = 'post';
  }
  if (req.method) {
    method = req.method;
  }
  return method;
}

function request(req, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return tracer.scoped(() => {
    tracer.setId(tracer.createChildId());
    const traceId = tracer.id;
    this.traceId = traceId;
    this.remoteServiceName = remoteServiceName;
    const reqWithHeaders = Request.addZipkinHeaders(req, traceId);

    const method = getRequestMethod(reqWithHeaders);
    tracer.recordServiceName(serviceName);
    tracer.recordRpc(method.toUpperCase());
    tracer.recordBinary('http.url', reqWithHeaders.path);
    tracer.recordAnnotation(new Annotation.ClientSend());

    return reqWithHeaders;
  });
}

function response(res, {tracer}) {
  tracer.scoped(() => {
    tracer.setId(this.traceId);
    const socket = res.raw.request.connection;
    tracer.recordAnnotation(new Annotation.LocalAddr({port: socket.localPort}));
    if (this.remoteServiceName) {
      tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: this.remoteServiceName,
        host: new InetAddress(socket.remoteAddress),
        port: socket.remotePort
      }));
    }
    tracer.recordBinary('http.status_code', res.status.code.toString());
    tracer.recordAnnotation(new Annotation.ClientRecv());
  });
  return res;
}

module.exports = interceptor({
  request,
  response
});
