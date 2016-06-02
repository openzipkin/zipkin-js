class Record {
  constructor({traceId, timestamp, annotation, duration}) {
    this.traceId = traceId;
    this.timestamp = timestamp;
    this.annotation = annotation;
    this.duration = duration;
  }
  toString() {
    return `Record(traceId=${this.traceId.toString()}, annotation=${this.annotation.toString()})`;
  }
}

module.exports = Record;
