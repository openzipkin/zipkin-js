const {Annotation, TraceId, HttpHeaders, option} = require('zipkin');

module.exports = function zipkinMiddleware({tracer, serviceName, port}) {
  return async (ctx, next) => {
    let id;

    const sampled = option.fromNullable(ctx.request.headers[HttpHeaders.Sampled.toLowerCase()]);
    const flags = option.fromNullable(ctx.request.headers[HttpHeaders.Flags.toLowerCase()])
      .map(parseInt).getOrElse(0);

    if (hasTrace(ctx.request)) {
      const traceId = option.fromNullable(ctx.request.headers[HttpHeaders.TraceId.toLowerCase()]);
      const parentId = option.fromNullable(ctx.request.headers[HttpHeaders.ParentSpanId.toLowerCase()]);
      const spanId = option.fromNullable(ctx.request.headers[HttpHeaders.SpanId.toLowerCase()]);
      id = new TraceId({traceId, parentId, spanId, sampled, flags});
    } else {
      const rootId = tracer.createRootId();
      if (sampled.present || typeof(flags) !== 'undefined') {
        id = new TraceId({
          traceId: option.fromNullable(rootId.traceId),
          parentId: option.fromNullable(rootId.parentId),
          spanId: option.fromNullable(rootId.spanId),
          sampled,
          flags
        });
      } else {
        id = rootId;
      }
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
