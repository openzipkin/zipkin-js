const {Annotation} = require('zipkin');

module.exports = function zipkinMiddleware(tracer) {
  return async (ctx, next) => {
    const id = tracer.createRootId();
    tracer.setId(id);
    tracer.recordServiceName('ms-1');
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
