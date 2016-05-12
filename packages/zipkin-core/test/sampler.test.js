const {MutableSpan} = require('../src/internalRepresentations');
const TraceId = require('../src/TraceId');
const {Sampler, CountingSampler} = require('../src/sampler');
const {Some, None} = require('../src/option');

function makeTestSpan({flags = 0, sampled = None}) {
  return new MutableSpan(new TraceId({
    traceId: new Some('abc'),
    parentId: new Some('123'),
    spanId: 'fab',
    sampled,
    flags
  }));
}

describe('Sampler', () => {
  it('should respect the debug flag', () => {
    const neverSample = () => false;
    const sampler = new Sampler(neverSample);
    expect(sampler.shouldSample(makeTestSpan({flags: 1}))).to.equal(true);
  });
  it('should respect the "sampled" property', () => {
    const neverSample = () => false;
    const sampler = new Sampler(neverSample());
    expect(sampler.shouldSample(makeTestSpan({sampled: new Some(true)}))).to.equal(true);

    const alwaysSample = () => true;
    const sampler2 = new Sampler(alwaysSample());
    expect(sampler2.shouldSample(makeTestSpan({sampled: new Some(false)}))).to.equal(false);
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
    const s = () => sampler.shouldSample(makeTestSpan({}));

    const sampled = [s(), s(), s(), s(), s(), s(), s(), s(), s()];
    const expected = [true, false, false, false, true, false, false, false, true];

    expect(sampled).to.deep.equal(expected);
  });

  it('should count, and sample every second sample (sample rate 0.5)', () => {
    const sampler = new CountingSampler(0.5);
    const s = () => sampler.shouldSample(makeTestSpan({}));

    const sampled = [s(), s(), s(), s(), s(), s(), s(), s(), s()];
    const expected = [true, false, true, false, true, false, true, false, true];

    expect(sampled).to.deep.equal(expected);
  });

  it('should not sample when sample rate is 0', () => {
    const sampler = new CountingSampler(0);
    const s = () => sampler.shouldSample(makeTestSpan({}));

    const sampled = [s(), s(), s(), s(), s(), s(), s(), s(), s()];
    const expected = [false, false, false, false, false, false, false, false, false];

    expect(sampled).to.deep.equal(expected);
  });

  it('sample rate >= 1 should always sample', () => {
    expect(new CountingSampler(5).toString()).to.equal('Sampler(always sample)');
  });
});
