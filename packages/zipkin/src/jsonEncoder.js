function toV1Endpoint(endpoint) {
  if (endpoint === undefined) {
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

function toV1Annotation(ann, endpoint) {
  return {
    value: ann.value,
    timestamp: ann.timestamp,
    endpoint
  };
}

function encodeV1(span) {
  const res = {
    traceId: span.traceId
  };
  if (span.parentId) { // instead of writing "parentId": NULL
    res.parentId = span.parentId;
  }
  res.id = span.id;
  res.name = span.name || ''; // undefined is not allowed in v1

  // Log timestamp and duration if this tracer started and completed this span.
  if (!span.shared) {
    res.timestamp = span.timestamp;
    res.duration = span.duration;
  }

  const jsonEndpoint = toV1Endpoint(span.localEndpoint);

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
    res.annotations = span.annotations.map((ann) =>
      toV1Annotation(ann, jsonEndpoint)
    );
  }

  if (beginAnnotation) {
    res.annotations.push({
      value: beginAnnotation,
      timestamp: span.timestamp,
      endpoint: jsonEndpoint
    });
    if (span.duration) {
      res.annotations.push({
        value: endAnnotation,
        timestamp: span.timestamp + span.duration,
        endpoint: jsonEndpoint
      });
    }
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
      endpoint: toV1Endpoint(span.remoteEndpoint)
    };
    res.binaryAnnotations.push(address);
  }

  if (span.debug) { // instead of writing "debug": false
    res.debug = true;
  }
  return JSON.stringify(res);
}

function encodeV2(span) {
  const copy = {
    traceId: span.traceId,
  };
  if (span.parentId) {
    copy.parentId = span.parentId;
  }
  copy.id = span.id;
  if (span.name) {
    copy.name = span.name;
  }
  if (span.kind) {
    copy.kind = span.kind;
  }
  if (span.timestamp) {
    copy.timestamp = span.timestamp;
  }
  if (span.duration) {
    copy.duration = span.duration;
  }
  if (span.localEndpoint) {
    copy.localEndpoint = span.localEndpoint;
  }
  if (span.remoteEndpoint) {
    copy.remoteEndpoint = span.remoteEndpoint;
  }
  if (span.annotations.length > 0) {
    copy.annotations = span.annotations;
  }
  if (Object.keys(span.tags).length > 0) {
    copy.tags = span.tags;
  }
  if (span.debug) {
    copy.debug = true;
  }
  if (span.shared) {
    copy.shared = true;
  }
  return JSON.stringify(copy);
}

module.exports.JSON_V1 = {
  encode(span) {
    return encodeV1(span);
  }
};
module.exports.JSON_V2 = {
  encode(span) {
    return encodeV2(span);
  }
};
