const {
  Some,
  None,
  verifyIsOptional,
  verifyIsNotOptional,
  isOptional
} = require('../option');

const T = new Some(true);

class TraceId {
  constructor(params) {
    const {
      spanId,
      traceId = spanId,
      parentId = None,
      flags = 0, // deprecated
      debug = flags === 1,
      sampled = None,
      shared = false
    } = params;
    verifyIsNotOptional(spanId);
    verifyIsOptional(parentId);
    verifyIsOptional(sampled);

    // support old signatures which allowed traceId to be optional
    if (isOptional(traceId)) {
      this._traceId = traceId.getOrElse(spanId);
    } else if (typeof traceId === 'undefined' || traceId === null) {
      this._traceId = spanId;
    } else {
      this._traceId = traceId;
    }

    this._parentId = parentId;
    this._spanId = spanId;
    this._sampled = debug ? T : sampled;
    this._debug = debug;
    this._shared = shared;
  }

  get traceId() {
    return this._traceId;
  }

  get parentSpanId() {
    return this._parentId;
  }

  /**
   * Please use parentSpanId instead as this can return confusing results (the span ID when absent).
   *
   * @deprecated since version v0.19
   */
  get parentId() {
    return this._parentId.getOrElse(this._spanId);
  }

  get spanId() {
    return this._spanId;
  }

  get sampled() {
    return this._sampled;
  }

  /**
   * Please use isDebug instead.
   *
   * @deprecated since version v0.19
   */
  get flags() {
    return this._debug ? 1 : 0;
  }

  isDebug() {
    return this._debug;
  }

  isShared() {
    return this._shared;
  }

  toString() {
    return `TraceId(spanId=${this.spanId.toString()}`
      + `, parentSpanId=${this.parentSpanId.toString()}`
      + `, traceId=${this.traceId.toString()})`;
  }
}

module.exports = TraceId;
