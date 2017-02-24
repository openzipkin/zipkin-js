const {HttpHeaders: Header, Annotation} = require('zipkin');
const url = require('url');

function addZipkinHeaders(req, traceId) {
  req.headers = req.headers || {};
  req.headers[Header.TraceId] = traceId.traceId;
  req.headers[Header.SpanId] = traceId.spanId;
  traceId._parentId.ifPresent(psid => {
    req.headers[Header.ParentSpanId] = psid;
  });
  traceId.sampled.ifPresent(sampled => {
    req.headers[Header.Sampled] = sampled ? '1' : '0';
  });
  return req;
}

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
      originalReq.traceId = traceId; // for use later when recording response
      const proxyReqWithZipkinHeaders = addZipkinHeaders(proxyReq, traceId);
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
