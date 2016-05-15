/* eslint-disable no-param-reassign */
const interceptor = require('rest/interceptor');
const {
  trace,
  HttpHeaders: Header,
  Annotation
} = require('zipkin-core');

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

function request(req, {serviceName}) {
  function recordTraceData(name) {
    const method = getRequestMethod(req);
    trace.recordServiceName(name);
    trace.recordRpc(method.toUpperCase());
    trace.recordBinary('http.url', req.path);
    trace.recordAnnotation(new Annotation.ClientSend());
  }

  trace.withContext(() => {
    trace.setId(trace.nextId());
    const traceId = trace.id();
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

    if (trace.isActivelyTracing()) {
      if (serviceName instanceof Function) {
        serviceName(req, recordTraceData);
      } else {
        recordTraceData(serviceName);
      }
    }
  });

  return req;
}

function response(res) {
  trace.withContext(() => {
    trace.setId(this.traceId);
    trace.recordBinary('http.status_code', res.status.code.toString());
    trace.recordAnnotation(new Annotation.ClientRecv());
  });
  return res;
}

module.exports = interceptor({
  request,
  response
});
