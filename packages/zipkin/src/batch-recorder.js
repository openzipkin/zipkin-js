const {now, hrtime} = require('./time');
const {Span, Endpoint} = require('./model');

function PartialSpan(traceId) {
  this.traceId = traceId;
  this.startTimestamp = now();
  this.startTick = hrtime();
  this.delegate = new Span(traceId);
  this.localEndpoint = new Endpoint({});
}
PartialSpan.prototype.finish = function finish() {
  if (this.endTimestamp) {
    return;
  }
  this.endTimestamp = now(this.startTimestamp, this.startTick);
};

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

    // TODO(adriancole) refactor so this responsibility isn't in writeSpan
    if (span === undefined) {
      // Span not found.  Could have been expired.
      return;
    }

    // ready for garbage collection
    this.partialSpans.delete(id);

    const spanToWrite = span.delegate;
    spanToWrite.setLocalEndpoint(span.localEndpoint);
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

  record(rec) {
    const id = rec.traceId;

    this._updateSpanMap(id, span => {
      switch (rec.annotation.annotationType) {
        case 'ClientSend':
          span.delegate.setKind('CLIENT');
          break;
        case 'ClientRecv':
          span.finish();
          span.delegate.setKind('CLIENT');
          break;
        case 'ServerSend':
          span.finish();
          span.delegate.setKind('SERVER');
          break;
        case 'ServerRecv':
          // TODO: only set this to false when we know we in an existing trace
          span.delegate.setShared(id.parentId !== id.spanId);
          span.delegate.setKind('CLIENT');
          break;
        case 'LocalOperationStart':
          span.delegate.setName(rec.annotation.name);
          break;
        case 'LocalOperationStop':
          span.finish();
          break;
        case 'Message':
          span.delegate.addAnnotation(rec.timestamp, rec.annotation.message);
          break;
        case 'Rpc':
          span.delegate.setName(rec.annotation.name);
          break;
        case 'ServiceName':
          span.localEndpoint.setServiceName(rec.annotation.serviceName);
          break;
        case 'BinaryAnnotation':
          span.delegate.putTag(rec.annotation.key, rec.annotation.value);
          break;
        case 'LocalAddr':
          span.localEndpoint.setIpv4(
            rec.annotation.host && rec.annotation.host.ipv4()
          );
          span.localEndpoint.setPort(rec.annotation.port);
          break;
        case 'ServerAddr':
          span.delegate.setKind('CLIENT');
          span.delegate.setRemoteEndpoint(new Endpoint({
            serviceName: rec.annotation.serviceName,
            ipv4: rec.annotation.host && rec.annotation.host.ipv4(),
            port: rec.annotation.port
          }));
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
