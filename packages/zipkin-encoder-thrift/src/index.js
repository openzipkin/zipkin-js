const {TBinaryProtocol, TBufferedTransport} = require('thrift');
const {InetAddress} = require('zipkin');
const thriftTypes = require('./gen-nodejs/zipkinCore_types');

function toThriftEndpoint(endpoint) {
  if (endpoint === undefined) {
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
  // thrift fields are i64, but accept hex input. That's why we set via strings.
  if (span.traceId.length <= 16) {
    res.trace_id = span.traceId;
  } else {
    res.trace_id_high = span.traceId.substr(0, 16);
    res.trace_id = span.traceId.substr(span.traceId.length - 16);
  }
  res.parent_id = span.parentId;
  res.id = span.id;
  res.name = span.name || ''; // undefined is not allowed in v1

  // Log timestamp and duration if this tracer started and completed this span.
  if (!span.shared) {
    res.timestamp = span.timestamp;
    res.duration = span.duration;
  }

  const thriftEndpoint = toThriftEndpoint(span.localEndpoint);

  let beginAnnotation;
  let endAnnotation;
  let addressKey;
  switch (span.kind) {
    case 'CLIENT':
      beginAnnotation = span.timestamp ? 'cs' : undefined;
      endAnnotation = 'cr';
      addressKey = 'sa';
      break;
    case 'SERVER':
      beginAnnotation = span.timestamp ? 'sr' : undefined;
      endAnnotation = 'ss';
      addressKey = 'ca';
      break;
    default:
  }

  if (span.annotations.length > 0 || beginAnnotation) { // don't write empty array
    res.annotations = span.annotations.map(ann => toThriftAnnotation(ann, thriftEndpoint));
  }

  if (beginAnnotation) {
    res.annotations.push(new thriftTypes.Annotation({
      value: beginAnnotation,
      timestamp: span.timestamp,
      host: thriftEndpoint
    }));
    if (span.duration) {
      res.annotations.push(new thriftTypes.Annotation({
        value: endAnnotation,
        timestamp: span.timestamp + span.duration,
        host: thriftEndpoint
      }));
    }
  }

  const keys = Object.keys(span.tags);
  if (keys.length > 0 || span.remoteEndpoint) { // don't write empty array
    res.binary_annotations = keys.map(key => toThriftBinaryAnnotation(
      key, span.tags[key], thriftEndpoint
    ));
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

module.exports = {
  encode(span) {
    const spanThrift = toThriftSpan(span);
    spanThrift.write(protocol);
    protocol.flush();
    return serialized;
  }
};
