const {InetAddress} = require('zipkin');
const thriftTypes = require('./gen-nodejs/zipkinCore_types');
const {TBufferedTransport, TBinaryProtocol} = require('thrift');

function toThriftEndpoint(endpoint) {
  if (endpoint === undefined || endpoint.isUnknown()) {
    return undefined;
  }
  const res = new thriftTypes.Endpoint({
    service_name: endpoint.serviceName || '', // undefined is not allowed in v1
  });
  if (endpoint.ipv4) {
    res.ipv4 = new InetAddress(endpoint.ipv4).toInt();
  } else {
    res.ipv4 = 0; // undefined not allowed in v1 thrift
  }
  if (endpoint.port) {
    res.port = endpoint.port;
  }
  return res;
}

function toThriftAnnotation(ann, thriftEndpoint) {
  const res = new thriftTypes.Annotation({
    timestamp: ann.timestamp, // must be in micros
    value: ann.value,
  });
  if (thriftEndpoint) {
    res.host = thriftEndpoint;
  }
  return res;
}

function toThriftBinaryAnnotation(key, value, thriftEndpoint) {
  const res = new thriftTypes.BinaryAnnotation({
    key,
    value,
    annotation_type: thriftTypes.AnnotationType.STRING
  });
  if (thriftEndpoint) {
    res.host = thriftEndpoint;
  }
  return res;
}

function toThriftAddress(key, endpoint) {
  const value = Buffer.from([1]);
  const res = new thriftTypes.BinaryAnnotation({
    key,
    value,
    annotation_type: thriftTypes.AnnotationType.BOOL,
    host: toThriftEndpoint(endpoint)
  });
  return res;
}

function toThriftSpan(span) {
  const res = new thriftTypes.Span();
  const traceId = span.traceId.traceId;

  // thrift fields are i64, but accept hex input. That's why we set via strings.
  if (traceId.length <= 16) {
    res.trace_id = traceId;
  } else {
    res.trace_id_high = traceId.substr(0, 16);
    res.trace_id = traceId.substr(traceId.length - 16);
  }
  span.traceId._parentId.ifPresent((id) => {
    res.parent_id = id;
  });
  res.id = span.traceId.spanId;
  res.name = span.name || ''; // undefined is not allowed in v1

  // Log timestamp and duration if this tracer started and completed this span.
  if (!span.shared && span.endTimestamp) {
    res.timestamp = span.startTimestamp;
    res.duration = Math.max(span.endTimestamp - span.startTimestamp, 1);
  }

  const thriftEndpoint = toThriftEndpoint(span.localEndpoint);

  let addressKey = 'sa'; // TODO: switch to span.kind
  if (span.annotations.length > 0) { // don't write empty array
    res.annotations = span.annotations.map((ann) => {
      if (ann.value === 'sr') {
        addressKey = 'ca';
      }
      return toThriftAnnotation(ann, thriftEndpoint);
    });
  }

  const keys = Object.keys(span.tags);
  if (keys.length > 0 || span.remoteEndpoint) { // don't write empty array
    res.binary_annotations = keys.map(key =>
      toThriftBinaryAnnotation(key, span.tags[key], thriftEndpoint));
  }

  if (span.remoteEndpoint) {
    const address = toThriftAddress(addressKey, span.remoteEndpoint);
    res.binary_annotations.push(address);
  }

  if (span.debug) {
    res.debug = true;
  }
  return res;
}

let serialized;
const transport = new TBufferedTransport(null, (res) => {
  serialized = res;
});
const protocol = new TBinaryProtocol(transport);

module.exports = function toThrift(span) {
  const spanThrift = toThriftSpan(span);
  spanThrift.write(protocol);
  protocol.flush();
  return serialized;
};
