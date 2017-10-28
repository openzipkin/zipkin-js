const testCases = {
  createSpan: function call({tracer, zipkin}) {
    return new Promise(resolve => {
      tracer.scoped(() => {
        tracer.setId(tracer.createRootId());
        const traceId = tracer.id;

        tracer.recordServiceName('test1');
        tracer.recordAnnotation(new zipkin.Annotation.ClientRecv());
        tracer.scoped(() => {
          tracer.setId(traceId);
          tracer.recordAnnotation(new zipkin.Annotation.ClientSend());
          resolve();
        });
      });
    });
  }
};
module.exports = testCases;
