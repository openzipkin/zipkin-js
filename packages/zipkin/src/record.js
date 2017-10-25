const {now, hrtime} = require('./time');

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
  this.traceId = traceId;
  this.startTimestamp = now();
  this.startTick = hrtime();
  this.name = undefined; // no default
  this.kind = undefined; // no default
  this.localEndpoint = new Endpoint({serviceName: 'unknown'});
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
Span.prototype.setLocalServiceName = function setLocalServiceName(serviceName) {
  this.localEndpoint.serviceName = serviceName;
};
Span.prototype.setLocalIpV4 = function setLocalIpV4(ipv4) {
  this.localEndpoint.ipv4 = ipv4;
};
Span.prototype.setLocalPort = function setLocalPort(port) {
  this.localEndpoint.port = port;
};
Span.prototype.setRemoteEndpoint = function setRemoteEndpoint(ep) {
  this.remoteEndpoint = ep;
};
Span.prototype.addAnnotation = function addAnnotation(timestamp, value) {
  if (!this.endTimestamp && (
    value === 'cr' ||
        value === 'ss'
  )) {
    this.endTimestamp = now(this.startTimestamp, this.startTick);
  }
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
  return `Span(id=${this.traceId.toString()}, annotations=[${annotations}])`;
};

module.exports.Endpoint = Endpoint;
module.exports.Annotation = Annotation;
module.exports.Span = Span;
