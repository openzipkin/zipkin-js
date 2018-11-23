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

  return (req) => tracer.scoped(() => {
    const {method, url} = req;
    const {headers} = instrumentation.recordRequest(req, url, method);
    // must get id ONLY AFTER recordRequest
    const traceId = tracer.id;

    const recordResponse = (res) => {
      instrumentation.recordResponse(traceId, res.statusCode);
    };

    const recordError = (error) => {
      instrumentation.recordError(traceId, error);
    };

    req.set(headers);
    req.on('response', recordResponse);
    req.on('error', recordError);

    return req;
  });
};

module.exports = plugin;
