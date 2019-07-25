import request from 'request-promise';
import {Instrumentation} from 'zipkin';
import {Deferred} from './promise';

const normalizeParameter = function(param) {
  let options = param;
  if (!param) {
    options = {};
  } else if (typeof param === 'string') {
    options = {
      uri: param,
    };
  }
  return options;
};

/**
 * Request class
 * @type {Request}
 */
const Request = class {
  constructor(tracer, remoteServiceName) {
    this.tracer = tracer;
    this.instrumentation = new Instrumentation.HttpClient({tracer, remoteServiceName});

    /**
     * This section is very important, it guarantees correct trace duration
     */
    this.httpRequest = request.defaults((options, callback) => tracer.scoped(() => {
      const method = options.method || 'GET';
      const url = options.uri || options.url;
      const wrappedOptions = this.instrumentation.recordRequest(options, url, method);
      const traceId = tracer.id;

      const recordResponse = response => tracer.scoped( // TODO: scoped bc recordResponse leaks
        () => this.instrumentation.recordResponse(traceId, response.statusCode)
      );

      const recordError = error => tracer.scoped( // TODO: scoped bc recordError leaks
        () => this.instrumentation.recordError(traceId, error)
      );

      return request(wrappedOptions, callback)
        .on('response', recordResponse)
        .on('error', recordError);
    }));
  }

  post(param, callback) {
    const options = normalizeParameter(param);
    options.method = 'POST';
    return this.send(options, callback);
  }

  get(param, callback) {
    const options = normalizeParameter(param);
    options.method = 'GET';
    return this.send(options, callback);
  }

  put(param, callback) {
    const options = normalizeParameter(param);
    options.method = 'PUT';
    return this.send(options, callback);
  }

  head(param, callback) {
    const options = normalizeParameter(param);
    options.method = 'HEAD';
    return this.send(options, callback);
  }

  delete(param, callback) {
    const options = normalizeParameter(param);
    options.method = 'DELETE';
    return this.send(options, callback);
  }

  send(options, callback) {
    const {tracer} = this;
    const defer = new Deferred(tracer);

    /**
     * It's better to bind the callback because request module
     * will destroy the response object during a timeout which
     * breaks zipkin scope
     */
    let cb = callback;
    if (typeof callback === 'function') {
      cb = this.tracer._ctxImpl._session.bind(callback);
    }

    const instance = this.httpRequest(options, cb);

    if (typeof cb === 'function') {
      return instance;
    }
    instance.then(defer.resolve, defer.reject);

    return defer.promise;
  }
};

/**
 * A wrapper function to conform to zipkin-instrumentation-request interface
 * @param tracer
 * @param serviceName
 * @returns Class
 */
const wrapRequest = (tracer, remoteServiceName) => function(params, callback) {
  const instance = new Request(tracer, remoteServiceName);
  return instance.send(params, callback);
};

export {wrapRequest, Request};
export default Request;
