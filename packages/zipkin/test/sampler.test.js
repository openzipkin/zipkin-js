const TraceId = require('../src/tracer/TraceId');
const {Sampler, CountingSampler} = require('../src/tracer/sampler');
const {Some, None} = require('../src/option');

const T = new Some(true);
const F = new Some(false);

function makeTestTraceId({debug = false, sampled = None}) {
  return new TraceId({
    traceId: 'abc',
    parentId: new Some('123'),
    spanId: 'fab',
    sampled,
    debug
  });
}

describe('Sampler', () => {
  it('should respect the debug flag', () => {
    const neverSample = () => false;
    const sampler = new Sampler(neverSample);
    expect(
      sampler.shouldSample(makeTestTraceId({debug: true}))
    ).to.eql(T);
  });
  it('should respect the "sampled" property when true', () => {
    const neverSample = () => false;
    const sampler = new Sampler(neverSample());
    expect(
      sampler.shouldSample(makeTestTraceId({sampled: T}))
    ).to.eql(T);
  });
  it('should respect the "sampled" property when false', () => {
    const alwaysSample = () => true;
    const sampler2 = new Sampler(alwaysSample());
    expect(
      sampler2.shouldSample(makeTestTraceId({sampled: F}))
    ).to.eql(F);
  });
});

describe('CountingSampler', () => {
  it('should have a toString method', () => {
    const sampler = new CountingSampler(0.42);
    expect(sampler.toString()).to.equal('Sampler(countingSampler: sampleRate=0.42)');
  });

  it('should show "never sample" in toString when sampleRate is 0', () => {
    const sampler = new CountingSampler(0);
    expect(sampler.toString()).to.equal('Sampler(never sample)');
  });

  it('should count, and sample every fourth sample (sample rate 0.25)', () => {
    const sampler = new CountingSampler(0.25);
    const s = () => sampler.shouldSample(makeTestTraceId({}));

    const sampled = [s(), s(), s(), s(), s(), s(), s(), s(), s()];
    const expected = [T, F, F, F, T, F, F, F, T];

    expect(sampled).to.deep.equal(expected);
  });

  it('should count, and sample every second sample (sample rate 0.5)', () => {
    const sampler = new CountingSampler(0.5);
    const s = () => sampler.shouldSample(makeTestTraceId({}));

    const sampled = [s(), s(), s(), s(), s(), s(), s(), s(), s()];
    const expected = [T, F, T, F, T, F, T, F, T];

    expect(sampled).to.deep.equal(expected);
  });

  it('should not sample when sample rate is 0', () => {
    const sampler = new CountingSampler(0);
    const s = () => sampler.shouldSample(makeTestTraceId({}));

    const sampled = [s(), s(), s(), s(), s(), s(), s(), s(), s()];
    const expected = [F, F, F, F, F, F, F, F, F];

    expect(sampled).to.deep.equal(expected);
  });

  it('sample rate >= 1 should always sample', () => {
    expect(new CountingSampler(5).toString()).to.equal('Sampler(always sample)');
  });
});
