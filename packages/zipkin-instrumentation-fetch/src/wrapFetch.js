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

function wrapFetch(fetch, {serviceName, tracer}) {
  return function zipkinfetch(url, opts) {
    return new Promise((resolve, reject) => {
      tracer.scoped(() => {
        tracer.setId(tracer.createChildId());
        const traceId = tracer.id;

        const method = opts.method || 'GET';
        tracer.recordServiceName(serviceName);
        tracer.recordRpc(method.toUpperCase());
        tracer.recordBinary('http.url', url);
        tracer.recordAnnotation(new Annotation.ClientSend());

        const headers = getHeaders(traceId, opts);
        const zipkinOpts = Object.assign({}, opts, {headers});

        fetch(url, zipkinOpts).then(res => {
          tracer.scoped(() => {
            tracer.setId(traceId);
            tracer.recordBinary('http.status_code', res.status.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
          resolve(res);
        }).catch(err => {
          tracer.scoped(() => {
            tracer.setId(traceId);
            tracer.recordBinary('request.error', err.toString());
            tracer.recordAnnotation(new Annotation.ClientRecv());
          });
          reject(err);
        });
      });
    });
  };
}

module.exports = wrapFetch;
