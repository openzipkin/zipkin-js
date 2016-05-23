const {trace, Annotation} = require('zipkin-core');

module.exports = function zipkinClient(Memcached, serviceName = 'memcached') {
  function mkZipkinCallback(callback, id) {
    return function zipkinCallback(err, data) {
      trace.withContext(() => {
        trace.setId(id);
        trace.recordAnnotation(new Annotation.ClientRecv());
      });
      callback.apply(this, arguments);
    }
  }
  function commonAnnotations(rpc) {
    trace.recordAnnotation(new Annotation.ClientSend());
    trace.recordServiceName(serviceName);
    trace.recordRpc(rpc);
  }

  class ZipkinMemcached extends Memcached {}
  function defaultAnnotator(key) {
    trace.recordBinary('memcached.key', key);
  }
  function multiAnnotator(keys) {
    trace.recordBinary('memcached.keys', keys.join(','));
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
    ZipkinMemcached.prototype[key] = function() {
      const args = [...arguments];
      const callback = args.pop();
      let id;
      trace.withNextId(nextId => {
        commonAnnotations(key);
        if (annotator) {
          annotator.apply(this, args);
        } else {
          defaultAnnotator.apply(this, args);
        }
        id = nextId;
      });
      const wrapper = mkZipkinCallback(callback, id);
      const newArgs = [...args, wrapper];
      actualFn.apply(this, newArgs);
    };
  });

  return ZipkinMemcached;
};
