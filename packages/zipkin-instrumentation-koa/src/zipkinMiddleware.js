const {Annotation, TraceId, HttpHeaders, option} = require('zipkin');

module.exports = function zipkinMiddleware({tracer, serviceName, port}) {
  return async (ctx, next) => {
    const id = getTraceId(ctx.request, tracer);

    tracer.setId(id);
    tracer.recordServiceName(serviceName);
    tracer.recordRpc(ctx.request.method.toUpperCase());
    tracer.recordBinary('http.url', ctx.request.href);
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordAnnotation(new Annotation.LocalAddr({port}));

    await next();

    tracer.setId(id);
    tracer.recordBinary('http.status_code', ctx.status.toString());
    tracer.recordAnnotation(new Annotation.ServerSend());
  };
};

function getTraceId(request, tracer) {
  const sampled = option.fromNullable(request.headers[HttpHeaders.Sampled.toLowerCase()])
    .flatMap(value => {
      if (value === '1') return option.fromNullable(true);
      if (value === '0') return option.fromNullable(false);
      return option.None;
    });

  const flags = option.fromNullable(request.headers[HttpHeaders.Flags.toLowerCase()])
    .map(parseInt).getOrElse();

  if (hasTrace(request)) {
    return traceIdFromHeaders(request, sampled, flags);
  }

  return rootTraceId(tracer, sampled, flags);
}

function hasTrace(request) {
  return typeof(request.headers[HttpHeaders.TraceId.toLowerCase()]) !== 'undefined'
    && typeof(request.headers[HttpHeaders.SpanId.toLowerCase()]) !== 'undefined';
}

function traceIdFromHeaders(request, sampled, flags) {
  const traceId = option.fromNullable(request.headers[HttpHeaders.TraceId.toLowerCase()]);
  const parentId = option.fromNullable(request.headers[HttpHeaders.ParentSpanId.toLowerCase()]);
  const spanId = option.fromNullable(request.headers[HttpHeaders.SpanId.toLowerCase()]);
  return new TraceId({traceId, parentId, spanId, sampled, flags});
}

function rootTraceId(tracer, sampled, flags) {
  const rootId = tracer.createRootId();
  if (sampled.present || typeof(flags) !== 'undefined') {
    return new TraceId({
      traceId: option.fromNullable(rootId.traceId),
      parentId: option.fromNullable(rootId.parentId),
      spanId: option.fromNullable(rootId.spanId),
      sampled,
      flags
    });
  }
  return rootId;
}
