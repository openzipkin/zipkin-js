const {Request, Annotation} = require('zipkin');
const Url = require('url');
const util = require('util');


// Utility function that converts a URL object into an ordinary
// options object as expected by the http.request and https.request
// APIs.
/* eslint-disable prefer-const */
function _urlToOptions(url) {
  let options = {
    protocol: url.protocol,
    host: url.host,
    hostname: url.hostname,
    hash: url.hash,
    search: url.search,
    pathname: url.pathname,
    path: `${url.pathname}${url.search}`,
    href: url.href
  };
  if (url.port !== '') {
    options.port = Number(url.port);
  }
  if (url.username || url.password) {
    options.auth = `${url.username}:${url.password}`;
  }
  return options;
}
/* eslint-enable prefer-const */

/**
 * Duplicates some logic in core nodejs _http_client library.  This is necessary to handle
 * whether a string OR object is passed into the options
 *
 * @param options
 * @returns {*}
 * @private
 */
/* eslint-disable no-param-reassign */
function _getOptions(options) {
  if (typeof options === 'string') {
    options = Url.parse(options);
    if (!options.hostname) {
      throw new Error('Unable to determine the domain name');
    }
  } else if (options instanceof Url.Url) {
    options = _urlToOptions(options);
  } else {
    options = util._extend({}, options);
  }

  return options;
}
/* eslint-enable no-param-reassign */

function _optionsToUrl(options) {
  let protocol = options.protocol ? options.protocol : 'http:';
  let host = options.host ? options.host.split(':')[0]: null;
  let hostname = options.hostname ? options.hostname.split(':')[0]: null;
  let port = options.port ? options.port: null;
  let path = options.path ? options.path: null;

  if (hostname) {
    return `${protocol}//${hostname}${(port ? ':' + port : '')}${(path ? path : '')}`
  }

  return `${protocol}//${host}${(port ? ':' + port : '')}${(path ? path : '')}`
}


function wrapHttp(http, {tracer, serviceName = 'unknown', remoteServiceName}) {
  return {
    get: (options, callback) => tracer.scoped(() => {
      tracer.setId(tracer.createChildId());
      const traceId = tracer.id;

      // Request headers are compat with http headers
      const wrappedOptions = Request.addZipkinHeaders(_getOptions(options), tracer.id);
      const method = wrappedOptions.method || 'GET';

      tracer.recordServiceName(serviceName);
      tracer.recordRpc(method.toUpperCase());
      tracer.recordBinary('http.url', _optionsToUrl(wrappedOptions));
      tracer.recordAnnotation(new Annotation.ClientSend());
      if (remoteServiceName) {
        tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: remoteServiceName
        }));
      }

      const recordResponse = (response) => {
        tracer.setId(traceId);
        tracer.recordBinary('http.status_code', response.statusCode.toString());
        tracer.recordAnnotation(new Annotation.ClientRecv());

        if (typeof callback === 'function') {
          callback(response);
        }
      };

      const recordError = (error) => {
        tracer.setId(traceId);
        tracer.recordBinary('error', error.toString());
        tracer.recordAnnotation(new Annotation.ClientRecv());

        if (typeof callback === 'function') {
          callback(error);
        }
      };

      return http.get(wrappedOptions)
        .once('response', recordResponse)
        .once('error', recordError);
    }),
    request: (options, callback) => tracer.scoped(() => {
      tracer.setId(tracer.createChildId());
      const traceId = tracer.id;

      // Request headers are compat with http headers
      const wrappedOptions = Request.addZipkinHeaders(_getOptions(options), tracer.id);
      const method = wrappedOptions.method || 'GET';

      tracer.recordServiceName(serviceName);
      tracer.recordRpc(method.toUpperCase());
      tracer.recordBinary('http.url', _optionsToUrl(wrappedOptions));
      tracer.recordAnnotation(new Annotation.ClientSend());
      if (remoteServiceName) {
        tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: remoteServiceName
        }));
      }

      const recordResponse = (response) => {
        tracer.setId(traceId);
        tracer.recordBinary('http.status_code', response.statusCode.toString());
        tracer.recordAnnotation(new Annotation.ClientRecv());

        if (typeof callback === 'function') {
          callback(response);
        }
      };

      const recordError = (error) => {
        tracer.setId(traceId);
        tracer.recordBinary('error', error.toString());
        tracer.recordAnnotation(new Annotation.ClientRecv());

        if (typeof callback === 'function') {
          callback(error);
        }
      };

      return http.request(wrappedOptions)
        .once('response', recordResponse)
        .once('error', recordError);
    })
  };
}

module.exports = wrapHttp;
