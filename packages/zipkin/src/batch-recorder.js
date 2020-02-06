const {now} = require('./time');
const {Span, Endpoint} = require('./model');

/**
 * defaultTags property name
 * @type {symbol}
 */
const defaultTagsSymbol = Symbol('defaultTags');

function _timedOut(span) {
  return span.timeoutTimestamp < now();
}

/**
 * @class PartialSpan
 */
class PartialSpan {
  /**
   * @constructor
   * @param {TraceId} traceId
   * @param {number} timeoutTimestamp (epoch in microseconds) after this moment, data
   * should be forcibly flushed
   */
  constructor(traceId, timeoutTimestamp) {
    this.traceId = traceId;
    this.timeoutTimestamp = timeoutTimestamp;
    this.delegate = new Span(traceId);
    this.localEndpoint = new Endpoint({});
    this.shouldFlush = false;
  }

  /**
   * Conditionally records the duration of the span, if it has a timestamp.
   *
   * @param {number} finishTimestamp (epoch in microseconds) to calculate the duration from
   */
  setDuration(finishTimestamp) {
    if (this.shouldFlush) {
      return;
    }

    this.shouldFlush = true; // even if we can't derive duration, we should report on finish

    const startTimestamp = this.delegate.timestamp;
    if (typeof startTimestamp === 'undefined') {
      // We can't calculate duration without a start timestamp,
      // but an annotation is better than nothing
      this.delegate.addAnnotation(finishTimestamp, 'finish');
    } else {
      this.delegate.setDuration(finishTimestamp - startTimestamp);
    }
  }
}

/**
 * default timeout = 60 seconds (in microseconds)
 * @type {number}
 */
const defaultTimeout = 60 * 1000000;

/**
 * @class BatchRecorder
 */
class BatchRecorder {
  /**
   * @constructor
   * @param {Object} options
   * @param {Logger} options.logger logs the data to zipkin server
   * @param {number} options.timeout timeout after which an unfinished span
   * is flushed to zipkin in **microseconds**. Passing this value has
   * implications in the reported data of the span so we discourage users
   * to pass a value for it unless there is a good reason for.
   */
  constructor({logger, timeout = defaultTimeout}) {
    this.logger = logger;
    this.timeout = timeout;
    /**
     * @type Map<string, PartialSpan>
     */
    this.partialSpans = new Map();
    this[defaultTagsSymbol] = {};

    // read through the partials spans regularly
    // and collect any timed-out ones
    const timer = setInterval(() => {
      this.partialSpans.forEach((span, id) => {
        if (_timedOut(span)) {
          // the zipkin-js.flush annotation makes it explicit that
          // the span has been reported because of a timeout, even
          // when it is not finished yet (and thus enqueued for reporting)
          span.delegate.addAnnotation(now(), 'zipkin-js.flush');
          this._writeSpan(id, span);
        }
      });
    }, 1000); // every second, this will flush to zipkin any spans that have timed out
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  _addDefaultTagsAndLocalEndpoint(span) {
    const defaultTags = this[defaultTagsSymbol];
    // eslint-disable-next-line no-restricted-syntax
    for (const tag in defaultTags) {
      if (Object.prototype.hasOwnProperty.call(defaultTags, tag)) {
        span.delegate.putTag(tag, defaultTags[tag]);
      }
    }

    span.delegate.setLocalEndpoint(span.localEndpoint);
  }

  _writeSpan(id, /** @type PartialSpan */ span, isNew = false) {
    // TODO(adriancole) refactor so this responsibility isn't in writeSpan
    if (!isNew && typeof this.partialSpans.get(id) === 'undefined') {
      // Span not found. Could have been expired.
      return;
    }

    // ready for garbage collection
    this.partialSpans.delete(id);

    const spanToWrite = span.delegate;
    // Only add default tags and local endpoint on the first report of a span
    if (span.delegate.timestamp) {
      this._addDefaultTagsAndLocalEndpoint(span);
    }
    this.logger.logSpan(spanToWrite);
  }

  _updateSpanMap(id, timestamp, updater) {
    let span;
    let isNew = false; // we need to special case late finish annotations
    if (this.partialSpans.has(id)) {
      span = this.partialSpans.get(id);
    } else {
      isNew = true;
      span = new PartialSpan(id, timestamp + this.timeout);
    }
    updater(span);
    if (span.shouldFlush) {
      this._writeSpan(id, span, isNew);
    } else {
      this.partialSpans.set(id, span);
    }
  }

  /**
   * Calling this will flush any pending spans to the transport.
   *
   * Note: the transport itself may be batching, in such case you may need to flush that also.
   */
  flush() {
    this.partialSpans.forEach((span, id) => {
      this._writeSpan(id, span);
    });
  }

  record(rec) {
    const id = rec.traceId;

    this._updateSpanMap(id, rec.timestamp, (/** @type PartialSpan */ span) => {
      switch (rec.annotation.annotationType) {
        case 'ClientAddr':
          span.delegate.setKind('SERVER');
          span.delegate.setRemoteEndpoint(new Endpoint({
            serviceName: rec.annotation.serviceName,
            ipv4: rec.annotation.host && rec.annotation.host.ipv4(),
            port: rec.annotation.port
          }));
          break;
        case 'ClientSend':
          span.delegate.setKind('CLIENT');
          span.delegate.setTimestamp(rec.timestamp);
          break;
        case 'ClientRecv':
          span.delegate.setKind('CLIENT');
          span.setDuration(rec.timestamp);
          break;
        case 'ServerSend':
          span.delegate.setKind('SERVER');
          span.setDuration(rec.timestamp);
          break;
        case 'ServerRecv':
          span.delegate.setShared(id.isShared());
          span.delegate.setKind('SERVER');
          span.delegate.setTimestamp(rec.timestamp);
          break;
        case 'ProducerStart':
          span.delegate.setKind('PRODUCER');
          span.delegate.setTimestamp(rec.timestamp);
          break;
        case 'ProducerStop':
          span.delegate.setKind('PRODUCER');
          span.setDuration(rec.timestamp);
          break;
        case 'ConsumerStart':
          span.delegate.setKind('CONSUMER');
          span.delegate.setTimestamp(rec.timestamp);
          break;
        case 'ConsumerStop':
          span.delegate.setKind('CONSUMER');
          span.setDuration(rec.timestamp);
          break;
        case 'MessageAddr':
          span.delegate.setRemoteEndpoint(new Endpoint({
            serviceName: rec.annotation.serviceName,
            ipv4: rec.annotation.host && rec.annotation.host.ipv4(),
            port: rec.annotation.port
          }));
          break;
        case 'LocalOperationStart':
          span.delegate.setName(rec.annotation.name);
          span.delegate.setTimestamp(rec.timestamp);
          break;
        case 'LocalOperationStop':
          span.setDuration(rec.timestamp);
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

  setDefaultTags(tags) {
    this[defaultTagsSymbol] = tags;
  }

  toString() { // eslint-disable-line class-methods-use-this
    return 'BatchRecorder()';
  }
}

module.exports = BatchRecorder;
