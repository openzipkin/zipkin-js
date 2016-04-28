const thriftTypes = require('./gen-nodejs/zipkinCore_types');
const {now} = require('./time');
const {Some, None} = require('./option');

function Endpoint({host = 0, port = 0}) {
  this.host = host;
  this.port = port;
}
Endpoint.prototype.isUnknown = function isUnknown() {
  return this.host === 0 && this.port === 0;
};
Endpoint.prototype.toThrift = function toThrift() {
  return new thriftTypes.Endpoint({
    ipv4: this.host,
    port: this.port
  });
};

function ZipkinAnnotation({timestamp, value, endpoint, duration}) {
  this.timestamp = timestamp;
  this.value = value;
  this.endpoint = endpoint;
  this.duration = duration;
}

ZipkinAnnotation.prototype.toThrift = function toThrift() {
  const res = new thriftTypes.Annotation({
    timestamp: this.timestamp, // must be in micros
    value: this.value
  });
  if (this.endpoint) {
    res.host = this.endpoint.toThrift();
  }
  if (this.duration) {
    res.duration = this.duration; // must be in micros
  }
  return res;
};
ZipkinAnnotation.prototype.toString = function toString() {
  return `Annotation(value="${this.value}")`;
};

function BinaryAnnotation({key, value, endpoint}) {
  this.key = key;
  this.value = value;
  this.endpoint = endpoint;
}
BinaryAnnotation.prototype.toThrift = function toThrift() {
  const res = new thriftTypes.BinaryAnnotation({
    key: this.key,
    value: this.value,
    annotation_type: thriftTypes.AnnotationType.STRING
  });
  if (this.endpoint) {
    res.host = this.endpoint.toThrift();
  }
  return res;
};

function MutableSpan(traceId) {
  this.traceId = traceId;
  this.complete = false;
  this.started = now();
  this.name = None;
  this.service = None;
  this.endpoint = new Endpoint({});
  this.annotations = [];
  this.binaryAnnotations = [];
}
MutableSpan.prototype.setName = function setName(name) {
  this.name = new Some(name);
};
MutableSpan.prototype.setServiceName = function setServiceName(name) {
  this.service = new Some(name);
};
MutableSpan.prototype.addAnnotation = function addAnnotation(ann) {
  if (!this.complete && (
        ann.value === thriftTypes.CLIENT_RECV ||
        ann.value === thriftTypes.SERVER_SEND
        )) {
    this.complete = true;
  }
  this.annotations.push(ann);
};
MutableSpan.prototype.addBinaryAnnotation = function addBinaryAnnotation(ann) {
  this.binaryAnnotations.push(ann);
};
MutableSpan.prototype.setEndpoint = function setEndpoint(ep) {
  this.endpoint = ep;
  /* eslint-disable no-param-reassign */
  this.annotations.forEach(ann => {
    if (ann.endpoint === undefined || ann.endpoint === null || ann.endpoint.isUnknown()) {
      ann.endpoint = ep;
    }
  });
};
MutableSpan.prototype.overrideEndpoint = function overrideEndpoint(ann) {
  const ep = ann.host != null ? ann.host : this.endpoint.toThrift();
  ep.service_name = this.service.getOrElse('Unknown');
  ann.host = ep;
};
MutableSpan.prototype.toThrift = function toThrift() {
  const span = new thriftTypes.Span();

  span.id = this.traceId.spanId;
  this.traceId._parentId.ifPresent(id => {
    span.parent_id = id;
  });

  span.trace_id = this.traceId.traceId;
  span.name = this.name.getOrElse('Unknown');
  span.debug = this.traceId.isDebug();

  span.annotations = this.annotations.map(ann => {
    const a = ann.toThrift();
    this.overrideEndpoint(a);
    return a;
  });

  span.binary_annotations = this.binaryAnnotations.map(ann => {
    const a = ann.toThrift();
    this.overrideEndpoint(a);
    return a;
  });

  return span;
};
MutableSpan.prototype.toString = function toString() {
  const annotations = this.annotations.map(a => a.toString()).join(', ');
  return `MutableSpan(id=${this.traceId.toString()}, annotations=[${annotations}])`;
};

module.exports.MutableSpan = MutableSpan;
module.exports.Endpoint = Endpoint;
module.exports.ZipkinAnnotation = ZipkinAnnotation;
module.exports.BinaryAnnotation = BinaryAnnotation;
