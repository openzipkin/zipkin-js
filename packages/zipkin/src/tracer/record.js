// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

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
