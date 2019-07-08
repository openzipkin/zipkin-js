const {
  Instrumentation
} = require('zipkin');

function wrapFetch(fetch, {tracer, serviceName, remoteServiceName}) {
  const instrumentation = new Instrumentation.HttpClient({tracer, serviceName, remoteServiceName});
  return function zipkinfetch(input, opts = {}) {
    return new Promise((resolve, reject) => {
      tracer.scoped(() => {
        const url = (typeof input === 'string') ? input : input.url;
        const method = opts.method || 'GET';
        const zipkinOpts = instrumentation.recordRequest(opts, url, method);
        const traceId = tracer.id;

        fetch(url, zipkinOpts).then((res) => {
          tracer.scoped(() => {
            instrumentation.recordResponse(traceId, res.status);
          });
          resolve(res);
        }).catch((err) => {
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
