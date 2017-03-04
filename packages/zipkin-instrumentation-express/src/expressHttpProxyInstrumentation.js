const {Request, Annotation} = require('zipkin');
const url = require('url');

function formatRequestUrl(proxyReq) {
  // Protocol is not available in proxyReq by express-http-proxy
  const parsedPath = url.parse(proxyReq.path);
  return url.format({
    hostname: proxyReq.hostname,
    port: proxyReq.port,
    pathname: parsedPath.pathname,
    search: parsedPath.search
  });
}

class ZipkinInstrumentation {
  constructor(tracer, serviceName, remoteServiceName) {
    this.tracer = tracer;
    this.serviceName = serviceName;
    this.remoteServiceName = remoteServiceName;
  }

  decorateAndRecordRequest(proxyReq, originalReq) {
    return this.tracer.scoped(() => {
      this.tracer.setId(this.tracer.createChildId());
      const traceId = this.tracer.id;
      // for use later when recording response
      originalReq.traceId = traceId; // eslint-disable-line no-param-reassign
      const proxyReqWithZipkinHeaders = Request.addZipkinHeaders(proxyReq, traceId);
      this._recordRequest(proxyReqWithZipkinHeaders);
      return proxyReqWithZipkinHeaders;
    });
  }

  _recordRequest(proxyReq) {
    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(proxyReq.method.toUpperCase());
    this.tracer.recordBinary('http.url', formatRequestUrl(proxyReq));
    this.tracer.recordAnnotation(new Annotation.ClientSend());
    if (this.remoteServiceName) {
      this.tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: this.remoteServiceName,
        port: proxyReq.port
      }));
    }
  }

  recordResponse(rsp, originalReq) {
    this.tracer.scoped(() => {
      this.tracer.setId(originalReq.traceId);
      this.tracer.recordBinary('http.status_code', rsp.statusCode.toString());
      this.tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }
}


module.exports = ZipkinInstrumentation;
