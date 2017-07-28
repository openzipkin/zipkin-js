const {Annotation, InetAddress} = require('zipkin');
const redisCommands = require('redis-commands');
module.exports = function zipkinClient(
  tracer,
  redis,
  options,
  serviceName = 'unknown',
  remoteServiceName = 'redis'
) {
  const sa = {
    serviceName: remoteServiceName,
    host: new InetAddress(options.host),
    port: options.port
  };
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
    tracer.recordRpc(rpc);
    tracer.recordAnnotation(new Annotation.ServiceName(serviceName));
    tracer.recordAnnotation(new Annotation.ServerAddr(sa));
    tracer.recordAnnotation(new Annotation.ClientSend());
  }


  const redisClient = redis.createClient(options);
  const methodsToWrap = redisCommands.list.concat('batch');
  const methodsThatReturnMulti = ['batch', 'multi'];
  const restrictedCommands = [
    'ping',
    'flushall',
    'flushdb',
    'select',
    'auth',
    'info',
    'quit',
    'slaveof',
    'config',
    'sentinel'];
  const wrap = function(client, parentId) {
    const clientNeedsToBeModified = client;
    methodsToWrap.forEach((method) => {
      if (restrictedCommands.indexOf(method) > -1) {
        return;
      }
      const actualFn = clientNeedsToBeModified[method];
      if (methodsThatReturnMulti.indexOf(method) > -1) {
        clientNeedsToBeModified[method] = function(...args) {
          const multiInstance = actualFn.apply(this, args);
          let id;
          tracer.scoped(() => {
            id = tracer.createChildId();
            tracer.setId(id);
            tracer.recordBinary('commands', args[0]);
          });
          wrap(multiInstance, id);
          return multiInstance;
        };
        return;
      }
      clientNeedsToBeModified[method] = function(...args) {
        const callback = args.pop();
        let id = parentId;
        tracer.scoped(() => {
          if (id === undefined) {
            id = tracer.createChildId();
          }
          tracer.setId(id);
          commonAnnotations(method);
        });
        const wrapper = mkZipkinCallback(callback, id);
        const newArgs = [...args, wrapper];
        actualFn.apply(this, newArgs);
      };
    });
  };

  wrap(redisClient);
  return redisClient;
};
