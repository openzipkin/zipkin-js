const {Annotation} = require('zipkin');

module.exports = function zipkinClient(tracer, redis, serviceName = 'redis') {
  function mkZipkinCallback(callback, id) {
    return function zipkinCallback(...args) {
      tracer.scoped(() => {
        tracer.setId(id);
        tracer.recordAnnotation(new Annotation.ClientRecv());
      });
      callback.apply(this, args);
    };
  }
  function commonAnnotations(rpc) {
    tracer.recordAnnotation(new Annotation.ClientSend());
    tracer.recordServiceName(serviceName);
    tracer.recordRpc(rpc);
  }

  function defaultAnnotator(key) {
    tracer.recordBinary('redis.key', key);
  }

  const methodsToWrap = [
    {key: 'get'},
    {key: 'set'},
    {key: 'append'},
    {key: 'lpush'},
    {key: 'incr'},
    {key: 'decr'},
    {key: 'del'}
  ];
  methodsToWrap.forEach(({key, annotator}) => {
    const actualFn = redis[key];
    redis[key] = function(...args) {
      const callback = args.pop();
      let id;
      tracer.scoped(() => {
        id = tracer.createChildId();
        tracer.setId(id);
        commonAnnotations(key);
        if (annotator) {
          annotator.apply(this, args);
        } else {
          defaultAnnotator.apply(this, args);
        }
      });
      const wrapper = mkZipkinCallback(callback, id);
      const newArgs = [...args, wrapper];
      actualFn.apply(this, newArgs);
    };
  });

  return redis;
};
