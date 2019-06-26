const {
  Some,
  None,
  verifyIsOptional,
  verifyIsNotOptional
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
    verifyIsNotOptional(traceId);
    verifyIsOptional(parentId);
    verifyIsOptional(sampled);
    this._traceId = traceId;
    this._parentId = parentId;
    this._spanId = spanId;
    this._sampled = debug ? T : sampled;
    this._debug = debug;
    this._shared = shared;
  }

  get traceId() {
    return this._traceId;
  }

  get parentId() {
    return this._parentId;
  }

  get spanId() {
    return this._spanId;
  }

  get sampled() {
    return this._sampled;
  }

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
    return `TraceId(spanId=${this.spanId.toString()}` +
      `, parentId=${this.parentId.toString()}` +
      `, traceId=${this.traceId.toString()})`;
  }
}

module.exports = TraceId;
