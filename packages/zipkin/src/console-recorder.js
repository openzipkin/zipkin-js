class ConsoleRecorder {
   /* eslint-disable no-console */
  constructor(logger = console.log) {
    this.logger = logger;
  }
  record(rec) {
    const id = rec.traceId;
    this.logger(
      `Record at (spanId=${id.spanId}, parentId=${id.parentId},` +
      ` traceId=${id.traceId}): ${rec.annotation.toString()}`
    );
  }

  toString() {
    return 'consoleTracer';
  }
}

module.exports = ConsoleRecorder;
