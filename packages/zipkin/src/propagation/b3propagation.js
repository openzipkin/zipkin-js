const {Some, None} = require('../option');
const TraceId = require('../tracer/TraceId');

function stringToBoolean(str) {
  return str === '1' || str === 'true';
}

function stringToIntOption(str) {
  try {
    return new Some(parseInt(str));
  } catch (err) {
    return None;
  }
}

class B3Propagation {
  constructor() {
    this.headers = {
      TraceId: 'X-B3-TraceId',
      SpanId: 'X-B3-SpanId',
      ParentSpanId: 'X-B3-ParentSpanId',
      Sampled: 'X-B3-Sampled',
      Flags: 'X-B3-Flags'
    };
  }

  extractor(tracer, readHeader) {
    if (readHeader(this.headers.TraceId) !== None && readHeader(this.headers.SpanId) !== None) {
      const spanId = readHeader(this.headers.SpanId);
      const parentId = spanId.map((sid) => {
        const traceId = readHeader(this.headers.TraceId);
        const parentSpanId = readHeader(this.headers.ParentSpanId);
        const sampled = readHeader(this.headers.Sampled);
        const flags = readHeader(this.headers.Flags).flatMap(stringToIntOption).getOrElse(0);
        return new TraceId({
          traceId: traceId.getOrElse(),
          parentId: parentSpanId,
          spanId: sid,
          debug: flags === 1,
          sampled: sampled.map(stringToBoolean),
        });
      });

      return new Some(tracer.join(parentId.getOrElse()));
    } else if (readHeader(this.headers.Flags) !== None
      || readHeader(this.headers.Sampled) !== None) {
      const sampled = readHeader(this.headers.Sampled) === None
        ? None : readHeader(this.headers.Sampled).map(stringToBoolean);
      const flags = readHeader(this.headers.Flags).flatMap(stringToIntOption).getOrElse(0);
      return new Some(tracer.createRootId(sampled, flags === 1));
    } else {
      return new Some(tracer.createRootId());
    }
  }

  injector(request, traceId) {
    const headers = request.headers || {};
    headers[this.headers.TraceId] = traceId.traceId;
    headers[this.headers.SpanId] = traceId.spanId;

    traceId.parentSpanId.ifPresent((psid) => {
      headers[this.headers.ParentSpanId] = psid;
    });
    traceId.sampled.ifPresent((sampled) => {
      headers[this.headers.Sampled] = sampled ? '1' : '0';
    });

    if (traceId.isDebug()) {
      headers[this.headers.Flags] = '1';
    }
    return headers;
  }
}

module.exports = B3Propagation;
