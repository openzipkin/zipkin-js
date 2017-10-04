const {
  Instrumentation
} = require('zipkin');

function wrapFetch(fetch, {tracer, serviceName = 'unknown', remoteServiceName}) {
  const instrumentation = new Instrumentation.HttpClient({tracer});
  return function zipkinfetch(url, opts = {}) {
    return new Promise((resolve, reject) => {
      tracer.scoped(() => {
        const method = opts.method || 'GET';
        const zipkinOpts =
          instrumentation.recordRequest(serviceName, opts, remoteServiceName, url, method);
        const traceId = tracer.id;

        fetch(url, zipkinOpts).then(res => {
          tracer.scoped(() => {
            instrumentation.recordResponse(traceId, res.status);
          });
          resolve(res);
        }).catch(err => {
          tracer.scoped(() => {
            instrumentation.recordError(traceId, err);
          });
          reject(err);
        });
      });
    });
  };
}

module.exports = wrapFetch;
