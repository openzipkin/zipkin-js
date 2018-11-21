import { expect } from 'chai';
import { sampler } from 'zipkin';

describe('Sampler', () => {
  it('should have correct type', () => {
    const sample: sampler.Sampler = new sampler.Sampler(() => false);

    expect(sample.shouldSample).to.be.a('function');
  });
});

describe('CountingSampler', () => {
  it('should have correct type', () => {
    const sample: sampler.CountingSampler = new sampler.CountingSampler(0.42);

    expect(sample.shouldSample).to.be.a('function');
  });
});
