const {Annotation, TraceId, HttpHeaders, option} = require('zipkin');

module.exports = function zipkinMiddleware({tracer, serviceName, port}) {
  return async (ctx, next) => {
    let id;
    if (hasTrace(ctx.request)) {
      const traceId = option.fromNullable(ctx.request.headers[HttpHeaders.TraceId.toLowerCase()]);
      const parentId = option.fromNullable(ctx.request.headers[HttpHeaders.ParentSpanId.toLowerCase()]);
      const spanId = option.fromNullable(ctx.request.headers[HttpHeaders.SpanId.toLowerCase()]);
      const sampled = option.fromNullable(ctx.request.headers[HttpHeaders.Sampled.toLowerCase()]);
      const flags = ctx.request.headers[HttpHeaders.Flags.toLowerCase()];
      id = new TraceId({traceId, parentId, spanId, sampled, flags});
    } else {
      id = tracer.createRootId();
    }
    tracer.setId(id);
    tracer.recordServiceName(serviceName);
    tracer.recordRpc(ctx.request.method.toUpperCase());
    tracer.recordBinary('http.url', ctx.request.path);
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordAnnotation(new Annotation.LocalAddr({port}));

    await next();

    tracer.setId(id);
    tracer.recordBinary('http.status_code', ctx.status.toString());
    tracer.recordAnnotation(new Annotation.ServerSend());
  };
};

function hasTrace(request) {
  return typeof(request.headers[HttpHeaders.TraceId.toLowerCase()]) !== 'undefined'
    && typeof(request.headers[HttpHeaders.SpanId.toLowerCase()]) !== 'undefined';
}
