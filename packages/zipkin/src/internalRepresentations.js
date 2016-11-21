const thriftTypes = require('./gen-nodejs/zipkinCore_types');
const {now, hrtime} = require('./time');
const {Some, None} = require('./option');

function Endpoint({serviceName, host, port}) {
  this.serviceName = serviceName;
  this.host = host || 0;
  this.port = port || 0;
}
function formatIPv4(host) {
  return host ?
    `${host >> 24 & 255}.${(host >> 16) & 255}.${(host >> 8) & 255}.${host & 255}` : 0;
}
Endpoint.prototype.isUnknown = function isUnknown() {
  return this.serviceName === undefined || this.host === 0 && this.port === 0;
};
Endpoint.prototype.toThrift = function toThrift() {
  return new thriftTypes.Endpoint({
    service_name: this.serviceName,
    ipv4: this.host,
    port: this.port
  });
};
Endpoint.prototype.toJSON = function toJSON() {
  return {
    serviceName: this.serviceName,
    ipv4: formatIPv4(this.host),
    port: this.port
  };
};

function ZipkinAnnotation({timestamp, value, endpoint}) {
  this.timestamp = timestamp;
  this.value = value;
  this.endpoint = endpoint;
}

ZipkinAnnotation.prototype.toThrift = function toThrift() {
  const res = new thriftTypes.Annotation({
    timestamp: this.timestamp, // must be in micros
    value: this.value
  });
  if (this.endpoint) {
    res.host = this.endpoint.toThrift();
  }
  return res;
};
ZipkinAnnotation.prototype.toJSON = function toJSON() {
  const res = {
    value: this.value,
    timestamp: this.timestamp
  };
  if (this.endpoint) {
    res.endpoint = this.endpoint.toJSON();
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
BinaryAnnotation.prototype.toJSON = function toJSON() {
  const res = {
    key: this.key,
    value: this.value
  };
  if (this.endpoint) {
    res.endpoint = this.endpoint.toJSON();
  }
  return res;
};

function Address({key, endpoint}) {
  this.key = key;
  this.endpoint = endpoint;
}
Address.prototype.toThrift = function toThrift() {
  const value = new Uint8Array(1);
  value[0] = 1;
  const res = new thriftTypes.BinaryAnnotation({
    key: this.key,
    value,
    annotation_type: thriftTypes.AnnotationType.BOOL,
    host: this.endpoint.toThrift()
  });
  return res;
};
Address.prototype.toJSON = function toJSON() {
  const res = {
    key: this.key,
    value: true,
    endpoint: this.endpoint.toJSON()
  };
  return res;
};

function MutableSpan(traceId) {
  this.traceId = traceId;
  this.startTimestamp = now();
  this.startTick = hrtime();
  this.name = None;
  this.service = None;
  this.endpoint = new Endpoint({});
  this.serverAddr = None;
  this.annotations = [];
  this.binaryAnnotations = [];
}
MutableSpan.prototype.setName = function setName(name) {
  this.name = new Some(name);
};
MutableSpan.prototype.setServiceName = function setServiceName(name) {
  this.service = new Some(name);
};
MutableSpan.prototype.setServerAddr = function setServerAddr(ep) {
  this.serverAddr = new Some(new Address({
    key: thriftTypes.SERVER_ADDR,
    endpoint: ep
  }));
};
MutableSpan.prototype.addAnnotation = function addAnnotation(ann) {
  if (!this.endTimestamp && (
        ann.value === thriftTypes.CLIENT_RECV ||
        ann.value === thriftTypes.SERVER_SEND
        )) {
    this.endTimestamp = now(this.startTimestamp, this.startTick);
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
MutableSpan.prototype.overrideEndpointJSON = function overrideEndpointJSON(ann) {
  if (!ann.endpoint) {
    ann.endpoint = this.endpoint.toJSON();
  }
};
MutableSpan.prototype.toThrift = function toThrift() {
  const span = new thriftTypes.Span();

  span.id = this.traceId.spanId;
  this.traceId._parentId.ifPresent(id => {
    span.parent_id = id;
  });

  const traceId = this.traceId.traceId;
  if (traceId.length <= 16) {
    span.trace_id = traceId;
  } else {
    span.trace_id_high = traceId.substr(0, 16);
    span.trace_id = traceId.substr(traceId.length - 16);
  }
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

  this.serverAddr.ifPresent(sa => {
    span.binary_annotations.push(sa.toThrift());
  });

  return span;
};
MutableSpan.prototype.toJSON = function toJSON() {
  let startedSpan = true;
  const trace = this.traceId;
  const spanJson = {
    traceId: trace.traceId,
    name: this.name.getOrElse('Unknown'),
    id: trace.spanId
  };
  trace._parentId.ifPresent(id => {
    spanJson.parentId = id;
  });
  spanJson.annotations = this.annotations.map(ann => {
    // In the RPC span model, the client owns the timestamp and duration of the
    // span. If we were propagated an id, we can assume that we shouldn't report
    // timestamp or duration, rather let the client do that. Worst case we were
    // propagated an unreported ID and Zipkin backfills timestamp and duration.
    if (ann.value === thriftTypes.SERVER_RECV) {
      // TODO: only set this to false when we know we in an existing trace
      startedSpan = false;
    }
    const annotationJson = ann.toJSON();
    this.overrideEndpointJSON(annotationJson);
    annotationJson.endpoint.serviceName = this.service.getOrElse('Unknown');
    return annotationJson;
  });
  spanJson.binaryAnnotations = this.binaryAnnotations.map(ann => {
    const annotationJson = ann.toJSON();
    this.overrideEndpointJSON(annotationJson);
    annotationJson.endpoint.serviceName = this.service.getOrElse('Unknown');
    return annotationJson;
  });
  this.serverAddr.ifPresent(sa => {
    spanJson.binaryAnnotations.push(sa.toJSON());
  });

  // Log timestamp and duration if this tracer started and completed this span.
  if (startedSpan && this.endTimestamp) {
    spanJson.timestamp = this.startTimestamp;
    spanJson.duration = Math.max(this.endTimestamp - this.startTimestamp, 1);
  }
  return spanJson;
};
MutableSpan.prototype.toString = function toString() {
  const annotations = this.annotations.map(a => a.toString()).join(', ');
  return `MutableSpan(id=${this.traceId.toString()}, annotations=[${annotations}])`;
};

module.exports.MutableSpan = MutableSpan;
module.exports.Endpoint = Endpoint;
module.exports.ZipkinAnnotation = ZipkinAnnotation;
module.exports.BinaryAnnotation = BinaryAnnotation;
