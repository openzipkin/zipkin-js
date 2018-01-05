const {Annotation} = require('zipkin');

module.exports = function zipkinClient(
  tracer,
  Memcached,
  serviceName = tracer.localEndpoint.serviceName,
  remoteServiceName = 'memcached'
) {
  function mkZipkinCallback(callback, id, originalID) {
    return function zipkinCallback(...args) {
      tracer.scoped(() => {
        tracer.setId(id);
        // TODO: parse host and port from details in callback
        // https://github.com/3rd-Eden/memcached#details-object
        tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: remoteServiceName
        }));
        tracer.recordAnnotation(new Annotation.ClientRecv());
      });
      tracer.setId(originalID);
      callback.apply(this, args);
    };
  }
  function commonAnnotations(rpc) {
    tracer.recordAnnotation(new Annotation.ClientSend());
    tracer.recordAnnotation(new Annotation.ServiceName(serviceName));
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
      const originalID = tracer.id;
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
      const wrapper = mkZipkinCallback(callback, id, originalID);
      const newArgs = [...args, wrapper];
      actualFn.apply(this, newArgs);
    };
  });

  return ZipkinMemcached;
};
