const {Instrumentation} = require('zipkin');

/**
 * @typedef {Object} Request
 * @property {string} url
 * @property {string} method
 * @property {Object} headers
 * @property {function(Object)} set
 * @property {function(string, function)} on
 */

/**
 * SuperAgent plugin
 * @param {Object} tracer
 * @param {string} serviceName
 * @param {string} remoteServiceName
 * @return {function(Request): Request}
 */
const plugin = ({tracer, serviceName, remoteServiceName}) => {
  const instrumentation = new Instrumentation.HttpClient({tracer, serviceName, remoteServiceName});

  return (req) => {
    const {method, url} = req;

    // capture the trace ID from recording the start of the request
    let traceId;
    const {headers} = tracer.scoped(() => {
      const injected = instrumentation.recordRequest(req, url, method);
      traceId = tracer.id;
      return injected;
    });

    // We can't use end() as the caller might be using it.
    // The following avoids double-recording on error as 4xx and 5xx are treated as errors.
    let done = false;
    const recordResponse = res => tracer.scoped(() => {
      if (done) return;
      done = true;
      instrumentation.recordResponse(traceId, res.statusCode);
    });

    const recordError = error => tracer.scoped(() => {
      if (done) return;
      done = true;
      instrumentation.recordError(traceId, error);
    });

    req.set(headers);
    req.on('response', recordResponse);
    req.on('error', recordError);

    return req;
  };
};

module.exports = plugin;
