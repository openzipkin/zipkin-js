const {trace, HttpHeaders, Annotation} = require('zipkin-core');

function wrapFetch(fetch, {serviceName}) {
  return function zipkinfetch(url, opts) {
    return new Promise((resolve, reject) => {
      function recordTraceData(name) {
        const method = opts.method || 'GET';
        trace.recordServiceName(name);
        trace.recordRpc(method.toUpperCase());
        trace.recordBinary('http.url', url);
        trace.recordAnnotation(new Annotation.ClientSend());
      }

      trace.withContext(() => {
        trace.setId(trace.nextId());
        const traceId = trace.id();

        const zipkinHeaders = opts.headers || {};
        zipkinHeaders[HttpHeaders.TraceId] = traceId.traceId;
        zipkinHeaders[HttpHeaders.SpanId] = traceId.spanId;
        traceId._parentId.ifPresent(psid => {
          zipkinHeaders[HttpHeaders.ParentSpanId] = psid;
        });
        traceId.sampled.ifPresent(sampled => {
          zipkinHeaders[HttpHeaders.Sampled] = sampled ? '1' : '0';
        });

        if (trace.isActivelyTracing()) {
          if (serviceName instanceof Function) {
            serviceName({url, opts}, recordTraceData);
          } else {
            recordTraceData(serviceName);
          }
        }

        const zipkinOpts = Object.assign({}, opts, {
          headers: zipkinHeaders
        });

        fetch(url, zipkinOpts).then(res => {
          trace.withContext(() => {
            trace.setId(traceId);
            trace.recordBinary('http.status_code', res.status.toString());
            trace.recordAnnotation(new Annotation.ClientRecv());
          });
          resolve(res);
        }).catch(err => {
          trace.withContext(() => {
            trace.setId(traceId);
            trace.recordBinary('request.error', err.toString());
            trace.recordAnnotation(new Annotation.ClientRecv());
          });
          reject(err);
        });
      });
    });
  };
}

module.exports = wrapFetch;
