const {now} = require('./time');
const {Span, Endpoint} = require('./record');

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
    const spanToWrite = this.partialSpans.get(id);
    // ready for garbage collection
    this.partialSpans.delete(id);
    this.logger.logSpan(spanToWrite);
  }

  _updateSpanMap(id, updater) {
    let span;
    if (this.partialSpans.has(id)) {
      span = this.partialSpans.get(id);
    } else {
      span = new Span(id);
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

  _setLocalEndpoint(span, ann) {
    if (ann.host) {
      span.setLocalIpV4(ann.host.ipv4());
    }
    const port = ann.port;
    if (port && port !== 0) {
      span.setLocalPort(port);
    }
  }

  _setRemoteEndpoint(span, ann) {
    const endpoint = new Endpoint({
      serviceName: ann.serviceName,
      port: ann.port
    });
    if (ann.host) {
      endpoint.ipv4 = ann.host.ipv4();
    }
    span.setRemoteEndpoint(endpoint);
  }

  record(rec) {
    const id = rec.traceId;

    this._updateSpanMap(id, (span) => {
      switch (rec.annotation.annotationType) {
        case 'ClientSend':
          span.addAnnotation(rec.timestamp, 'cs');
          break;
        case 'ClientRecv':
          span.addAnnotation(rec.timestamp, 'cr');
          break;
        case 'ServerSend':
          span.addAnnotation(rec.timestamp, 'ss');
          break;
        case 'ServerRecv':
          // TODO: only set this to false when we know we in an existing trace
          span.setShared(id.parentId !== id.spanId);
          span.addAnnotation(rec.timestamp, 'sr');
          break;
        case 'Message':
          span.addAnnotation(rec.timestamp, rec.annotation.message);
          break;
        case 'Rpc':
          span.setName(rec.annotation.name);
          break;
        case 'ServiceName':
          span.setLocalServiceName(rec.annotation.serviceName);
          break;
        case 'BinaryAnnotation':
          span.putTag(rec.annotation.key, rec.annotation.value);
          break;
        case 'LocalAddr':
          this._setLocalEndpoint(span, rec.annotation);
          break;
        case 'ServerAddr':
          this._setRemoteEndpoint(span, rec.annotation);
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
