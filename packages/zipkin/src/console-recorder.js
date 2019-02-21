/**
 * @class ConsoleRecorder
 */
class ConsoleRecorder {
   /* eslint-disable no-console */
  constructor(logger = console.log) {
    this.logger = logger;
  }

  record(rec) {
    const {spanId, parentId, traceId} = rec.traceId;
    this.logger(
      `Record at (spanId=${spanId}, parentId=${parentId}, ` +
      `traceId=${traceId}): ${rec.annotation.toString()}`
    );
  }

  toString() {
    return 'consoleTracer';
  }

}

module.exports = ConsoleRecorder;
