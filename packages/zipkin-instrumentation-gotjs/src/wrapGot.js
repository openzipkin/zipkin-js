const {
  Instrumentation
} = require('zipkin');

// Use underscore for storing context inside the Got options as suggested
// by the upstream authors https://github.com/sindresorhus/got/issues/740
const ZIPKIN_CONTEXT_KEY = '_zipkin';

function getZipkinContext(opts) {
  if (!opts[ZIPKIN_CONTEXT_KEY]) {
    Object.assign(opts, {[ZIPKIN_CONTEXT_KEY]: {}});
  }
  return opts[ZIPKIN_CONTEXT_KEY];
}

function wrapGot(got, {tracer, serviceName, remoteServiceName}) {
  const instrumentation = new Instrumentation.HttpClient({tracer, serviceName, remoteServiceName});

  return got.extend({
    hooks: {
      init: [
        (opts) => {
          const ctx = getZipkinContext(opts);
          ctx.parentId = tracer.id;
        }
      ],
      beforeRequest: [
        (opts) => {
          const url = opts.href;
          const method = opts.method || 'GET';
          const ctx = getZipkinContext(opts);
          tracer.letId(ctx.parentId, () => {
            instrumentation.recordRequest(opts, url, method);
            ctx.traceId = tracer.id;
          });
        }
      ],
      afterResponse: [
        (res) => {
          const ctx = getZipkinContext(res.request.gotOptions);
          tracer.scoped(() => {
            instrumentation.recordResponse(ctx.traceId, res.statusCode);
          });
          return res;
        }
      ],
      beforeError: [
        (err) => {
          if (!err.gotOptions) return err;
          const ctx = getZipkinContext(err.gotOptions);
          tracer.scoped(() => {
            instrumentation.recordError(ctx.traceId, err);
          });
          return err;
        }
      ]
    }
  });
}

module.exports = wrapGot;
