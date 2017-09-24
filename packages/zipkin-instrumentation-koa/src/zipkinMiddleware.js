const {Annotation, TraceId, option: {Some, None}} = require('zipkin');

module.exports = function zipkinMiddleware({tracer, serviceName}) {
  return async (ctx, next) => {
    let id;
    if (ctx.request.headers['x-b3-traceid']) {
      const traceId = new Some(ctx.request.headers['x-b3-traceid']);
      const parentId = new Some(ctx.request.headers['x-b3-parentspanid']);
      const spanId = new Some(ctx.request.headers['x-b3-spanid']);
      id = new TraceId({traceId, parentId, spanId});
    } else {
      id = tracer.createRootId();
    }
    tracer.setId(id);
    tracer.recordServiceName(serviceName);
    tracer.recordRpc(ctx.request.method.toUpperCase());
    tracer.recordBinary('http.url', ctx.request.path);
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordAnnotation(new Annotation.LocalAddr({port: '3001'}));

    await next();

    tracer.setId(id);
    tracer.recordBinary('http.status_code', ctx.status.toString());
    tracer.recordAnnotation(new Annotation.ServerSend());
  };
};
