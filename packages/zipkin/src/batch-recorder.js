const {now} = require('./time');
const thriftTypes = require('./gen-nodejs/zipkinCore_types');
const {
  MutableSpan,
  Endpoint,
  ZipkinAnnotation,
  BinaryAnnotation
} = require('./internalRepresentations');

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
      span = new MutableSpan(id);
    }
    updater(span);
    if (span.complete) {
      this._writeSpan(id);
    } else {
      this.partialSpans.set(id, span);
    }
  }

  _timedOut(span) {
    return span.started + this.timeout < now();
  }


  _annotate(span, {timestamp}, value) {
    span.addAnnotation(new ZipkinAnnotation({
      timestamp,
      value
    }));
  }

  _binaryAnnotate(span, key, value) {
    span.addBinaryAnnotation(new BinaryAnnotation({
      key,
      value,
      annotationType: thriftTypes.AnnotationType.STRING
    }));
  }

  record(rec) {
    const id = rec.traceId;

    this._updateSpanMap(id, span => {
      switch (rec.annotation.annotationType) {
        case 'ClientSend':
          this._annotate(span, rec, thriftTypes.CLIENT_SEND);
          break;
        case 'ClientRecv':
          this._annotate(span, rec, thriftTypes.CLIENT_RECV);
          break;
        case 'ServerSend':
          this._annotate(span, rec, thriftTypes.SERVER_SEND);
          break;
        case 'ServerRecv':
          this._annotate(span, rec, thriftTypes.SERVER_RECV);
          break;
        case 'Message':
          this._annotate(span, rec, rec.annotation.message);
          break;
        case 'Rpc':
          span.setName(rec.annotation.name);
          break;
        case 'ServiceName':
          span.setServiceName(rec.annotation.serviceName);
          break;
        case 'BinaryAnnotation':
          this._binaryAnnotate(span, rec.annotation.key, rec.annotation.value);
          break;
        case 'LocalAddr':
          span.setEndpoint(new Endpoint({
            host: rec.annotation.host.toInt(),
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
