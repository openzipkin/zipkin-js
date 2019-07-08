const {Annotation, InetAddress} = require('zipkin');

// TODO: function wrapPostgres(postgres, options = {})
// as it is easy to get the service name and remote service name wrong when using positional args
module.exports = function zipkinClient(
  tracer,
  Postgres,
  serviceName = tracer.localEndpoint.serviceName,
  remoteServiceName = 'postgres'
) {
  function annotateSuccess(id) {
    tracer.letId(id, () => {
      tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }
  function annotateError(id, error) {
    tracer.letId(id, () => {
      tracer.recordBinary('error', error.message || String(error));
      tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }
  function mkZipkinCallback(callback, id) {
    return function zipkinCallback(...args) {
      if (args[0]) {
        annotateError(id, args[0]);
      } else {
        annotateSuccess(id);
      }
      callback.apply(this, args);
    };
  }

  class ZipkinPostgresClient extends Postgres.Client {}
  const ZipkinPostgres = Object.assign({}, Postgres, {
    Client: ZipkinPostgresClient,
    Pool: function BoundPool(options) {
      return new Postgres.Pool(Object.assign({Client: ZipkinPostgresClient}, options));
    }
  });

  const actualFn = ZipkinPostgresClient.prototype.query;
  ZipkinPostgresClient.prototype.query = function(config, values, callback) {
    const id = tracer.createChildId();
    tracer.letId(id, () => {
      tracer.recordAnnotation(new Annotation.ClientSend());
      tracer.recordAnnotation(new Annotation.ServiceName(serviceName));
      tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: remoteServiceName,
        host: new InetAddress(this.host),
        port: this.port.toString()
      }));
      tracer.recordRpc(`query ${this.database}`);
    });

    if (typeof config.submit === 'function') {
      const query = actualFn.call(this, config, values, callback);
      query.on('end', () => {
        annotateSuccess(id);
      });
      query.on('error', (error) => {
        annotateError(id, error);
      });
      return query;
    }

    if (typeof values === 'function') {
      callback = callback || values; // eslint-disable-line no-param-reassign
    }

    if (typeof callback === 'function') {
      return actualFn.call(this, config, values, mkZipkinCallback(callback, id));
    }

    const promise = actualFn.call(this, config, values, callback);
    return promise.then(() => {
      annotateSuccess(id);
      return promise;
    }, (error) => {
      annotateError(id, error);
      return promise;
    });
  };

  return ZipkinPostgres;
};
