function Endpoint({serviceName, ipv4, port}) {
  this.setServiceName(serviceName);
  this.setIpv4(ipv4);
  this.setPort(port);
}
Endpoint.prototype.setServiceName = function setServiceName(serviceName) {
  // In zipkin, names are lowercase. This eagerly converts to alert users early.
  this.serviceName = serviceName ? serviceName.toLocaleLowerCase() : undefined;
};
Endpoint.prototype.setIpv4 = function setIpv4(ipv4) {
  this.ipv4 = ipv4;
};
Endpoint.prototype.setPort = function setPort(port) {
  this.port = port || undefined;
};
Endpoint.prototype.isEmpty = function isEmpty() {
  return this.serviceName === undefined
         && this.ipv4 === undefined && this.port === undefined;
};

function Annotation(timestamp, value) {
  this.timestamp = timestamp;
  this.value = value.toString();
}
Annotation.prototype.toString = function toString() {
  return `Annotation(value="${this.value}")`;
};

function Span(traceId) {
  this.traceId = traceId.traceId;
  traceId.parentSpanId.ifPresent((id) => {
    this.parentId = id;
  });
  this.id = traceId.spanId;
  this.name = undefined; // no default
  this.kind = undefined; // no default
  this.timestamp = undefined;
  this.duration = undefined;
  this.localEndpoint = undefined; // no default
  this.remoteEndpoint = undefined; // no default
  this.annotations = [];
  this.tags = {};
  this.debug = traceId.isDebug();
  this.shared = traceId.isShared();
}

Span.prototype.setName = function setName(name) {
  // In zipkin, names are lowercase. This eagerly converts to alert users early.
  this.name = name ? name.toLocaleLowerCase() : undefined;
};
Span.prototype.setKind = function setKind(kind) {
  this.kind = kind;
};
Span.prototype.setTimestamp = function setTimestamp(timestamp) {
  this.timestamp = timestamp;
};
Span.prototype.setDuration = function setDuration(duration) {
  // Due to rounding errors, a fraction ends up as zero, so check undefined
  if (typeof duration !== 'undefined') {
    this.duration = Math.max(duration, 1);
  }
};
Span.prototype.setLocalEndpoint = function setLocalEndpoint(ep) {
  if (ep && !ep.isEmpty()) {
    this.localEndpoint = ep;
  } else {
    this.localEndpoint = undefined;
  }
};
Span.prototype.setRemoteEndpoint = function setRemoteEndpoint(ep) {
  if (ep && !ep.isEmpty()) {
    this.remoteEndpoint = ep;
  } else {
    this.remoteEndpoint = undefined;
  }
};
Span.prototype.addAnnotation = function addAnnotation(timestamp, value) {
  this.annotations.push(new Annotation(timestamp, value));
};
Span.prototype.putTag = function putTag(key, value) {
  this.tags[key] = value.toString();
};
Span.prototype.setDebug = function setDebug(debug) {
  this.debug = debug;
};
Span.prototype.setShared = function setShared(shared) {
  this.shared = shared;
};
Span.prototype.toString = function toString() {
  const annotations = this.annotations.map(a => a.toString()).join(', ');
  return `Span(id=${this.traceId}, annotations=[${annotations}])`;
};

module.exports.Endpoint = Endpoint;
module.exports.Span = Span;
