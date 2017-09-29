const Header = require('../httpHeaders');
const { Some, None } = require('../option');
const TraceId = require('../tracer/TraceId');

function stringToBoolean(str) {
  return str === '1';
}

function stringToIntOption(str) {
  try {
    return new Some(parseInt(str));
  } catch (err) {
    return None;
  }
}

function containsRequiredHeaders(readHeader) {
  return readHeader(Header.TraceId) !== None && readHeader(Header.SpanId) !== None;
}

function createIdFromHeaders(tracer, readHeader) {
  if (containsRequiredHeaders(readHeader)) {
    const spanId = readHeader(Header.SpanId);
    return spanId.map(sid => {
      const traceId = readHeader(Header.TraceId);
      const parentSpanId = readHeader(Header.ParentSpanId);
      const sampled = readHeader(Header.Sampled);
      const flags = readHeader(Header.Flags).flatMap(stringToIntOption).getOrElse(0);
      return new TraceId({
        traceId,
        parentId: parentSpanId,
        spanId: sid,
        sampled: sampled.map(stringToBoolean),
        flags
      });
    });
  } else {
    if (readHeader(Header.Flags) !== None) {
      const currentId = tracer.id;
      const idWithFlags = new TraceId({
        traceId: currentId.traceId,
        parentId: currentId.parentId,
        spanId: currentId.spanId,
        sampled: currentId.sampled,
        flags: readHeader(Header.Flags)
      });
      return new Some(idWithFlags);
    } else {
      return new Some(tracer.createRootId());
    }
  }
}

module.exports = {
  createIdFromHeaders
};
