const {Some, None, verifyIsOptional} = require('../option');

class TraceId {
  constructor(params) {
    const {traceId = None, parentId = None, spanId, sampled = None, flags = 0} = params;
    verifyIsOptional(traceId);
    verifyIsOptional(parentId);
    verifyIsOptional(sampled);
    this._traceId = traceId;
    this._parentId = parentId;
    this._spanId = spanId;
    this._sampled = sampled;
    this._flags = flags;
  }

  get spanId() {
    return this._spanId;
  }

  get parentId() {
    return this._parentId.getOrElse(this.spanId);
  }

  get traceId() {
    return this._traceId.getOrElse(this.parentId);
  }

  get sampled() {
    return this.isDebug() ? new Some(true) : this._sampled;
  }

  get flags() {
    return this._flags;
  }

  isDebug() {
    // The jshint tool always complains about using bitwise operators,
    // but in this case it's actually intentional, so we disable the warning:
    // jshint bitwise: false
    return (this._flags & 1) === 1;
  }

  toString() {
    return `TraceId(spanId=${this.spanId.toString()}` +
      `, parentId=${this.parentId.toString()}` +
      `, traceId=${this.traceId.toString()})`;
  }
}

module.exports = TraceId;
