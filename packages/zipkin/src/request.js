const HttpHeaders = require('./httpHeaders');

function appendZipkinHeaders(req, traceId) {
  const headers = req.headers || {};
  headers[HttpHeaders.TraceId] = traceId.traceId;
  headers[HttpHeaders.SpanId] = traceId.spanId;

  traceId.parentSpanId.ifPresent((psid) => {
    headers[HttpHeaders.ParentSpanId] = psid;
  });
  traceId.sampled.ifPresent((sampled) => {
    headers[HttpHeaders.Sampled] = sampled ? '1' : '0';
  });

  if (traceId.isDebug()) {
    headers[HttpHeaders.Flags] = '1';
  }

  return headers;
}

function addZipkinHeaders(req, traceId) {
  const headers = appendZipkinHeaders(req, traceId);
  return Object.assign({}, req, {headers});
}

module.exports = {
  addZipkinHeaders
};
