/* eslint-disable no-param-reassign */
const interceptor = require('rest/interceptor');
const {
  Instrumentation
  } = require('zipkin');

function getRequestMethod(req) {
  let method = 'get';
  if (req.entity) {
    method = 'post';
  }
  if (req.method) {
    method = req.method;
  }
  return method;
}

function request(req, {tracer, serviceName, remoteServiceName}) {
  this.instrumentation = new Instrumentation.HttpClient({tracer, serviceName, remoteServiceName});
  return tracer.scoped(() => {
    const reqWithHeaders =
      this.instrumentation.recordRequest(req, req.path, getRequestMethod(req));
    this.traceId = tracer.id;
    return reqWithHeaders;
  });
}

function response(res, {tracer}) {
  tracer.scoped(() => {
    this.instrumentation.recordResponse(this.traceId, res.status.code);
  });
  return res;
}

module.exports = interceptor({
  request,
  response
});
