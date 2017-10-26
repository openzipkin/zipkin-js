function Endpoint({serviceName, ipv4, port}) {
  this.serviceName = serviceName;
  this.ipv4 = ipv4;
  this.port = port;
}
Endpoint.prototype.isUnknown = function isUnknown() {
  return (this.serviceName === undefined || this.serviceName === 'unknown') &&
          this.ipv4 === undefined && this.port === undefined;
};

function Annotation(timestamp, value) {
  this.timestamp = timestamp;
  this.value = value;
}
Annotation.prototype.toString = function toString() {
  return `Annotation(value="${this.value}")`;
};

function Span(traceId) {
  this.traceId = traceId.traceId;
  traceId._parentId.ifPresent((id) => {
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
  this.shared = false;
}

Span.prototype.setName = function setName(name) {
  this.name = name;
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
  if (ep && !ep.isUnknown()) {
    this.localEndpoint = ep;
  } else {
    this.localEndpoint = undefined;
  }
};
Span.prototype.setRemoteEndpoint = function setRemoteEndpoint(ep) {
  this.remoteEndpoint = ep;
};
Span.prototype.addAnnotation = function addAnnotation(timestamp, value) {
  this.annotations.push(new Annotation(timestamp, value));
};
Span.prototype.putTag = function putTag(key, value) {
  this.tags[key] = value;
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
