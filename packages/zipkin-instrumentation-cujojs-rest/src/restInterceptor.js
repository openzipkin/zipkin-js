/* eslint-disable no-param-reassign */
const interceptor = require('rest/interceptor');
const {
  HttpHeaders: Header,
  Annotation
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
  tracer.scoped(() => {
    tracer.setId(tracer.createChildId());
    const traceId = tracer.id;
    this.traceId = traceId;

    req.headers = req.headers || {};
    req.headers[Header.TraceId] = traceId.traceId;
    req.headers[Header.SpanId] = traceId.spanId;
    traceId._parentId.ifPresent(psid => {
      req.headers[Header.ParentSpanId] = psid;
    });
    traceId.sampled.ifPresent(sampled => {
      req.headers[Header.Sampled] = sampled ? '1' : '0';
    });

    const method = getRequestMethod(req);
    tracer.recordServiceName(serviceName);
    tracer.recordRpc(method.toUpperCase());
    tracer.recordBinary('http.url', req.path);
    tracer.recordAnnotation(new Annotation.ClientSend());
    if (remoteServiceName) {
      // TODO: can we get the host and port of the http connection?
      tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: remoteServiceName
      }));
    }
  });

  return req;
}

function response(res, {tracer}) {
  tracer.scoped(() => {
    tracer.setId(this.traceId);
    tracer.recordBinary('http.status_code', res.status.code.toString());
    tracer.recordAnnotation(new Annotation.ClientRecv());
  });
  return res;
}

module.exports = interceptor({
  request,
  response
});
