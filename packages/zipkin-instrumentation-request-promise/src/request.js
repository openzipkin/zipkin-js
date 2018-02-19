import request from 'request-promise';
import _ from 'lodash';
import { Instrumentation } from 'zipkin';
import { Deferred } from './promise';

const normalizeParameter = function(param) {
  let options = param;
  if (!param) {
    options = {};
  }
  else if (typeof param === 'string') {
    options = {
      uri: param,
    }
  }
  return options;
};

export default class Request {
  constructor(tracer, serviceName, remoteServiceName) {
    this.tracer = tracer;
    this.instrumentation =
      new Instrumentation.HttpClient({
        tracer,
        serviceName,
        remoteServiceName,
      });

    /**
     * This section is very important, it guaranty correct trace duration
     */
    this.httpRequest = request.defaults((options, callback) => tracer.scoped(() => {
      const method = options.method || 'GET';
      const url = options.uri || options.url;
      const wrappedOptions =
        this.instrumentation.recordRequest(options, url, method);
      const traceId = tracer.id;

      const recordResponse = (response) => {
        this.instrumentation.recordResponse(traceId, response.statusCode);
      };

      const recordError = (error) => {
        this.instrumentation.recordError(traceId, error);
      };

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
    const { tracer } = this;
    const defer = new Deferred(tracer);
    const instance = this.httpRequest(options, callback);

    if (_.isFunction(callback)) {
      return instance;
    }
    instance.catch(defer.reject);
    instance.then(defer.resolve);

    return defer.promise;
  }
}
