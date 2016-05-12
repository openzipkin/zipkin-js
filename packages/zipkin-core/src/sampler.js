// Determines whether or not a span should be sampled.
// If no sample decision is already made (by a debug flag, or
// the "sampled" property is set), it will use evaluator,
// which is a function Span => Boolean, and returns true if
// the span should be sampled (stored in Zipkin).
class Sampler {
  constructor(evaluator) {
    this.evaluator = evaluator;
  }

  shouldSample(span) {
    return span.traceId.sampled.getOrElse(() => this.evaluator(span));
  }

  toString() {
    return `Sampler(${this.evaluator.toString()})`;
  }
}

function neverSample(span) { // eslint-disable-line no-unused-vars
  return false;
}
neverSample.toString = () => 'never sample';

function alwaysSample(span) { // eslint-disable-line no-unused-vars
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
    const counting = function counting(span) { // eslint-disable-line no-unused-vars
      counter = counter % limit;
      const shouldSample = counter === 0;
      counter++;
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

module.exports = {Sampler, CountingSampler, neverSample, alwaysSample};
