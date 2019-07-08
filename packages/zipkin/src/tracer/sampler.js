const {Some} = require('../option');
// Determines whether or not a traceId should be sampled.
// If no sample decision is already made (by a debug flag, or
// the "sampled" property is set), it will use evaluator,
// which is a function traceId => Boolean, and returns true if
// the traceId should be sampled (stored in Zipkin).
class Sampler {
  constructor(evaluator) {
    this.evaluator = evaluator;
  }

  shouldSample(traceId) {
    const result = traceId.sampled.getOrElse(() => this.evaluator(traceId));
    return new Some(result);
  }

  toString() {
    return `Sampler(${this.evaluator.toString()})`;
  }
}

function neverSample(traceId) { // eslint-disable-line no-unused-vars
  return false;
}
neverSample.toString = () => 'never sample';

function alwaysSample(traceId) { // eslint-disable-line no-unused-vars
  return true;
}
alwaysSample.toString = () => 'always sample';

function makeCountingEvaluator(sampleRate) {
  if (sampleRate <= 0) {
    return neverSample;
  } else if (sampleRate >= 1) {
    return alwaysSample;
  } else {
    let counter = 0;
    const limit = parseInt(1 / sampleRate);
    const counting = function counting(traceId) { // eslint-disable-line no-unused-vars
      counter %= limit;
      const shouldSample = counter === 0;
      counter += 1;
      return shouldSample;
    };
    counting.toString = () => `countingSampler: sampleRate=${sampleRate}`;
    return counting;
  }
}

class CountingSampler extends Sampler {
  constructor(sampleRate = 1) {
    super(makeCountingEvaluator(sampleRate < 1 ? sampleRate : 1));
  }
}

module.exports = {
  Sampler, CountingSampler, neverSample, alwaysSample
};
