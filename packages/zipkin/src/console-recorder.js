/**
 * defaultTags property name
 * @type {symbol}
 */
const defaultTagsSymbol = Symbol('defaultTags');

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
    const defaultTags = this[defaultTagsSymbol] || {};
    const tags = JSON.parse(defaultTags);

    this.logger(
      `Record at (spanId=${spanId}, parentId=${parentId}, ` +
      `traceId=${traceId}, defaultTags=${tags}): ${rec.annotation.toString()}`
    );
  }

  toString() {
    return 'consoleTracer';
  }

  setDefaultTags(tags) {
    this[defaultTagsSymbol] = tags;
  }

}

module.exports = ConsoleRecorder;
