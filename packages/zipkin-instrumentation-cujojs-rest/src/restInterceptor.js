/* eslint-disable no-param-reassign */
const interceptor = require('rest/interceptor');
const {
  Instrumentation
} = require('zipkin');

function getRequestMethod(req) {
  if (req.entity) {
    return 'post';
  }
  if (req.method) {
    return req.method;
  }
  return 'get';
}

function request(req, {tracer, serviceName, remoteServiceName}) {
  this.instrumentation = new Instrumentation.HttpClient({tracer, serviceName, remoteServiceName});
  return tracer.scoped(() => {
    const reqWithHeaders = this.instrumentation.recordRequest(req, req.path, getRequestMethod(req));
    this.traceId = tracer.id;
    return reqWithHeaders;
  });
}

function response(res, {tracer}) {
  tracer.scoped(() => {
    if (res.error) { // check error, not status because in chrome it is sometimes zero!
      this.instrumentation.recordError(this.traceId, res.error);
    } else {
      this.instrumentation.recordResponse(this.traceId, res.status.code);
    }
  });
  return res;
}

module.exports = interceptor({
  request,
  response
});
