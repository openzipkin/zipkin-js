const {Annotation} = require('zipkin');

module.exports = function zipkinClient(tracer, Memcached, serviceName = 'memcached') {
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

  class ZipkinMemcached extends Memcached {}
  function defaultAnnotator(key) {
    tracer.recordBinary('memcached.key', key);
  }
  function multiAnnotator(keys) {
    tracer.recordBinary('memcached.keys', keys.join(','));
  }

  const methodsToWrap = [
    {key: 'touch'},
    {key: 'get'},
    {key: 'gets'},
    {key: 'getMulti', annotator: multiAnnotator},
    {key: 'set'},
    {key: 'replace'},
    {key: 'add'},
    {key: 'cas'},
    {key: 'append'},
    {key: 'prepend'},
    {key: 'incr'},
    {key: 'decr'},
    {key: 'del'}
  ];
  methodsToWrap.forEach(({key, annotator}) => {
    const actualFn = ZipkinMemcached.prototype[key];
    ZipkinMemcached.prototype[key] = function(...args) {
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

  return ZipkinMemcached;
};
