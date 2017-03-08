const {Annotation, Request} = require('zipkin');

function wrapFetch(fetch, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return function zipkinfetch(url, opts = {}) {
    return new Promise((resolve, reject) => {
      tracer.scoped(() => {
        tracer.setId(tracer.createChildId());
        const traceId = tracer.id;

        const method = opts.method || 'GET';
        tracer.recordServiceName(serviceName);
        tracer.recordRpc(method.toUpperCase());
        tracer.recordBinary('http.url', url);
        tracer.recordAnnotation(new Annotation.ClientSend());
        if (remoteServiceName) {
          // TODO: can we get the host and port of the http connection?
          tracer.recordAnnotation(new Annotation.ServerAddr({
            serviceName: remoteServiceName
          }));
        }

        const zipkinOpts = Request.addZipkinHeaders(opts, traceId);
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
