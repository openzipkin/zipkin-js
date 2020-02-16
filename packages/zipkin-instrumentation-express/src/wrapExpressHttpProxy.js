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
    function wrapProxyReqOptDecorator(instrumentation, proxyReqOptDecorator) {
      return (proxyReq, serverReq) => {
        const serverTraceId = serverReq._trace_id;
        let wrappedProxyReq = proxyReq;
        if (typeof proxyReqOptDecorator === 'function') {
          tracer.letId(serverTraceId, () => {
            wrappedProxyReq = proxyReqOptDecorator(proxyReq, serverReq);
          });
        }

        return instrumentation.decorateAndRecordRequest(serverReq, wrappedProxyReq, serverTraceId);
      };
    }

    function wrapUserResDecorator(instrumentation, userResDecorator) {
      return (rsp, data, serverReq, res) => {
        const serverTraceId = serverReq._trace_id;
        if (typeof userResDecorator === 'function') {
          let decoratedResponse;
          tracer.letId(serverTraceId, () => {
            decoratedResponse = userResDecorator(rsp, data, serverReq, res);
            instrumentation.recordResponse(rsp, serverReq._trace_id_proxy);
          });
          return decoratedResponse;
        } else {
          instrumentation.recordResponse(rsp, serverReq._trace_id_proxy);
          return data;
        }
      };
    }

    const instrumentation = new ExpressHttpProxyInstrumentation(
      {tracer, serviceName, remoteServiceName}
    );

    const wrappedOptions = options;

    const {proxyReqOptDecorator} = wrappedOptions;
    wrappedOptions.proxyReqOptDecorator = wrapProxyReqOptDecorator(
      instrumentation, proxyReqOptDecorator
    );

    const {userResDecorator} = wrappedOptions;
    wrappedOptions.userResDecorator = wrapUserResDecorator(instrumentation, userResDecorator);

    return proxy(host, wrappedOptions);
  };
}

module.exports = wrapProxy;
