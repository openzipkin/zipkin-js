class Record {
  constructor({traceId, timestamp, annotation}) {
    this.traceId = traceId;
    this.timestamp = timestamp;
    this.annotation = annotation;
  }
  toString() {
    return `Record(traceId=${this.traceId.toString()}, annotation=${this.annotation.toString()})`;
  }
}

module.exports = Record;
