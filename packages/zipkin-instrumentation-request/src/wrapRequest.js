const {HttpHeaders, Annotation} = require('zipkin');

function getHeaders(traceId, opts) {
  const headers = opts.headers || {};
  headers[HttpHeaders.TraceId] = traceId.traceId;
  headers[HttpHeaders.SpanId] = traceId.spanId;

  traceId._parentId.ifPresent(psid => {
    headers[HttpHeaders.ParentSpanId] = psid;
  });
  traceId.sampled.ifPresent(sampled => {
    headers[HttpHeaders.Sampled] = sampled ? '1' : '0';
  });

  return headers;
}

function wrapRequest(request, {serviceName, tracer}) {
  return function zipkinrequest(opts, cb) {
    tracer.scoped(() => {

      tracer.setId(tracer.createChildId());
      const traceId = tracer.id;

      const method = opts.method || 'GET';
      tracer.recordServiceName(serviceName);
      tracer.recordRpc(method.toUpperCase());
      tracer.recordBinary('http.url', opts.url || opts.uri);
      tracer.recordAnnotation(new Annotation.ClientSend());

      const headers = getHeaders(traceId, opts);
      const zipkinOpts = Object.assign({}, opts, {headers});

      request(zipkinOpts, function (error, response, body) {

        if (error) {
          tracer.scoped(() => {
            tracer.setId(traceId);
            tracer.recordBinary('request.error', error.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
          return cb(error, response, body);
        }

        tracer.scoped(() => {
          tracer.setId(traceId);
          tracer.recordBinary('http.status_code', response.statusCode.toString());
          tracer.recordAnnotation(new Annotation.ClientRecv());
        });
        cb(error, response, body);
      });
    });
  };
}

module.exports = wrapRequest;
