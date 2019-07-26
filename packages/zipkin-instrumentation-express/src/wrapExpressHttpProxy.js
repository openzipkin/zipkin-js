const {Request, Annotation} = require('zipkin');
const url = require('url');

function getPathnameFromPath(path) {
  const parsedPath = url.parse(path);
  return parsedPath.pathname;
}

class ExpressHttpProxyInstrumentation {
  constructor({tracer, serviceName = tracer.localEndpoint.serviceName, remoteServiceName}) {
    this.tracer = tracer;
    this.serviceName = serviceName;
    this.remoteServiceName = remoteServiceName;
  }

  decorateAndRecordRequest(serverReq, proxyReq, serverTraceId) {
    return this.tracer.letId(serverTraceId, () => {
      const clientTraceId = this.tracer.createChildId();
      this.tracer.setId(clientTraceId);

      const proxyReqWithZipkinHeaders = Request.addZipkinHeaders(proxyReq, clientTraceId);
      Object.defineProperty(serverReq, '_trace_id_proxy',
        {configurable: false, get: () => clientTraceId});

      this._recordRequest(proxyReqWithZipkinHeaders);
      return proxyReqWithZipkinHeaders;
    });
  }

  _recordRequest(proxyReq) {
    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(proxyReq.method.toUpperCase());
    this.tracer.recordBinary('http.path', getPathnameFromPath(proxyReq.path));
    this.tracer.recordAnnotation(new Annotation.ClientSend());
    if (this.remoteServiceName) {
      this.tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: this.remoteServiceName,
        port: parseInt(proxyReq.port)
      }));
    }
  }

  recordResponse(rsp, clientTraceId) {
    this.tracer.letId(clientTraceId, () => {
      this.tracer.recordBinary('http.status_code', rsp.statusCode.toString());
      this.tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }
}

function wrapProxy(proxy, {tracer, serviceName, remoteServiceName}) {
  return function zipkinProxy(host, options = {}) {
    function wrapDecorateRequest(instrumentation, decorateRequest) {
      return (proxyReq, serverReq) => {
        const serverTraceId = serverReq._trace_id;
        let wrappedProxyReq = proxyReq;
        if (typeof decorateRequest === 'function') {
          tracer.letId(serverTraceId, () => {
            wrappedProxyReq = decorateRequest(proxyReq, serverReq);
          });
        }

        return instrumentation.decorateAndRecordRequest(serverReq, wrappedProxyReq, serverTraceId);
      };
    }

    function wrapIntercept(instrumentation, intercept) {
      return (rsp, data, serverReq, res, callback) => {
        const instrumentedCallback = (err, rspd, sent) => {
          instrumentation.recordResponse(rsp, serverReq._trace_id_proxy);
          return callback(err, rspd, sent);
        };

        const serverTraceId = serverReq._trace_id;
        if (typeof intercept === 'function') {
          tracer.letId(serverTraceId,
            () => intercept(rsp, data, serverReq, res, instrumentedCallback));
        } else {
          instrumentedCallback(null, data);
        }
      };
    }

    const instrumentation = new ExpressHttpProxyInstrumentation(
      {tracer, serviceName, remoteServiceName}
    );

    const wrappedOptions = options;

    const {decorateRequest} = wrappedOptions;
    wrappedOptions.decorateRequest = wrapDecorateRequest(instrumentation, decorateRequest);

    const {intercept} = wrappedOptions;
    wrappedOptions.intercept = wrapIntercept(instrumentation, intercept);

    return proxy(host, wrappedOptions);
  };
}

module.exports = wrapProxy;
