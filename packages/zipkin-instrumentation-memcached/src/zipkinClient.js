const {Annotation} = require('zipkin');

module.exports = function zipkinClient(
  tracer,
  Memcached,
  serviceName = tracer.localEndpoint.serviceName,
  remoteServiceName = 'memcached'
) {
  function mkZipkinCallback(callback, id) {
    const originalId = tracer.id;
    return function zipkinCallback(...args) {
      tracer.letId(id, () => {
        // TODO: parse host and port from details in callback
        // https://github.com/3rd-Eden/memcached#details-object
        tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: remoteServiceName
        }));
        tracer.recordAnnotation(new Annotation.ClientRecv());
      });
      // callback runs after the client request, so let's restore the former ID
      tracer.letId(originalId, () => {
        callback.apply(this, args);
      });
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
      const id = tracer.createChildId();
      tracer.letId(id, () => {
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
