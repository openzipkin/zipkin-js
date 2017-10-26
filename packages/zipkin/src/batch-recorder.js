const {now, hrtime} = require('./time');
const {Span, Endpoint} = require('./model');

function PartialSpan(traceId) {
  this.traceId = traceId;
  this.startTimestamp = now();
  this.startTick = hrtime();
  this.delegate = new Span(traceId);
  this.localEndpoint = new Endpoint({serviceName: 'unknown'});
}

class BatchRecorder {
  constructor({
    logger,
    timeout = 60 * 1000000 // default timeout = 60 seconds
  }) {
    this.logger = logger;
    this.timeout = timeout;
    this.partialSpans = new Map();

    // read through the partials spans regularly
    // and collect any timed-out ones
    const timer = setInterval(() => {
      this.partialSpans.forEach((span, id) => {
        if (this._timedOut(span)) {
          this._writeSpan(id);
        }
      });
    }, 1000);
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  _writeSpan(id) {
    const span = this.partialSpans.get(id);
    // ready for garbage collection
    this.partialSpans.delete(id);

    const spanToWrite = span.delegate;
    if (span.endTimestamp) {
      spanToWrite.setTimestamp(span.startTimestamp);
      spanToWrite.setDuration(span.endTimestamp - span.startTimestamp);
    }
    this.logger.logSpan(spanToWrite);
  }

  _updateSpanMap(id, updater) {
    let span;
    if (this.partialSpans.has(id)) {
      span = this.partialSpans.get(id);
    } else {
      span = new PartialSpan(id);
    }
    updater(span);
    if (span.endTimestamp) {
      this._writeSpan(id);
    } else {
      this.partialSpans.set(id, span);
    }
  }

  _timedOut(span) {
    return span.startTimestamp + this.timeout < now();
  }

  _decorateEndpoint(endpoint, ann) {
    /* eslint-disable no-param-reassign */
    if (ann.host) {
      endpoint.ipv4 = ann.host.ipv4();
    }
    if (ann.port && ann.port !== 0) {
      endpoint.port = ann.port;
    }
    return endpoint;
  }

  record(rec) {
    const id = rec.traceId;

    this._updateSpanMap(id, span => {
      switch (rec.annotation.annotationType) {
        case 'ClientSend':
          span.delegate.setKind('CLIENT');
          break;
        case 'ClientRecv':
          if (!span.endTimestamp) {
            span.endTimestamp = now(span.startTimestamp, span.startTick);
          }
          span.delegate.setKind('CLIENT');
          break;
        case 'ServerSend':
          if (!span.endTimestamp) {
            span.endTimestamp = now(span.startTimestamp, span.startTick);
          }
          span.delegate.setKind('SERVER');
          break;
        case 'ServerRecv':
          // TODO: only set this to false when we know we in an existing trace
          span.delegate.setShared(id.parentId !== id.spanId);
          span.delegate.setKind('CLIENT');
          break;
        case 'Message':
          span.delegate.addAnnotation(rec.timestamp, rec.annotation.message);
          break;
        case 'Rpc':
          span.delegate.setName(rec.annotation.name);
          break;
        case 'ServiceName':
          span.localEndpoint.serviceName = rec.annotation.serviceName;
          span.delegate.setLocalEndpoint(span.localEndpoint);
          break;
        case 'BinaryAnnotation':
          span.delegate.putTag(rec.annotation.key, rec.annotation.value);
          break;
        case 'LocalAddr':
          span.delegate.setLocalEndpoint(this._decorateEndpoint(
            span.delegate.localEndpoint,
            rec.annotation
          ));
          break;
        case 'ServerAddr':
          span.delegate.setKind('CLIENT');
          span.delegate.setRemoteEndpoint(this._decorateEndpoint(
            new Endpoint({serviceName: rec.annotation.serviceName}),
            rec.annotation
          ));
          break;
        default:
          break;
      }
    });
  }

  toString() {
    return 'BatchRecorder()';
  }
}

module.exports = BatchRecorder;
