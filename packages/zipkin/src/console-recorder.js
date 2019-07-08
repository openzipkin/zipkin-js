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
      `Record at (timestamp=${rec.timestamp}, spanId=${spanId}, parentId=${parentId}, `
      + `traceId=${traceId}): ${rec.annotation.toString()}`
    );
  }

  toString() { // eslint-disable-line class-methods-use-this
    return 'consoleTracer';
  }
}

module.exports = ConsoleRecorder;
