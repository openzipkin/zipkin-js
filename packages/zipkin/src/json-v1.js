function toJSONEndpoint(endpoint) {
  if (endpoint === undefined || endpoint.isUnknown()) {
    return undefined;
  }
  const res = {
    serviceName: endpoint.serviceName || '', // undefined is not allowed in v1
  };
  if (endpoint.ipv4) {
    res.ipv4 = endpoint.ipv4;
  }
  if (endpoint.port) {
    res.port = endpoint.port;
  }
  return res;
}

function toJSONAnnotation(ann, endpoint) {
  return {
    value: ann.value,
    timestamp: ann.timestamp,
    endpoint
  };
}

module.exports = function toJsonV1(span) {
  const trace = span.traceId;
  const res = {
    traceId: trace.traceId
  };
  trace._parentId.ifPresent((id) => {
    res.parentId = id;
  });
  res.id = trace.spanId;
  res.name = span.name || ''; // undefined is not allowed in v1

  // Log timestamp and duration if this tracer started and completed this span.
  if (!span.shared && span.endTimestamp) {
    res.timestamp = span.startTimestamp;
    res.duration = Math.max(span.endTimestamp - span.startTimestamp, 1);
  }

  const jsonEndpoint = toJSONEndpoint(span.localEndpoint);

  let addressKey = 'sa'; // TODO: switch to span.kind
  if (span.annotations.length > 0) { // don't write empty array
    res.annotations = span.annotations.map((ann) => {
      if (ann.value === 'sr') {
        addressKey = 'ca';
      }
      return toJSONAnnotation(ann, jsonEndpoint);
    });
  }

  const keys = Object.keys(span.tags);
  if (keys.length > 0 || span.remoteEndpoint) { // don't write empty array
    res.binaryAnnotations = keys.map(key => ({
      key,
      value: span.tags[key],
      endpoint: jsonEndpoint
    }));
  }

  if (span.remoteEndpoint) {
    const address = {
      key: addressKey,
      value: true,
      endpoint: toJSONEndpoint(span.remoteEndpoint)
    };
    res.binaryAnnotations.push(address);
  }

  if (span.debug) {
    res.debug = true;
  }
  return JSON.stringify(res);
};
