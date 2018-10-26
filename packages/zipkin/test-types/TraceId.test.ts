import { TraceId, option } from 'zipkin';
import { expect } from 'chai';

describe('TraceId', () => {
  it('should have correct type', () => {
    const traceId: TraceId = new TraceId({
      traceId: new option.Some('48485a3953bb6124'),
      spanId: '48485a3953bb6124'
    });

    const sampled: option.IOption<boolean> = traceId.sampled;

    expect(sampled.map).to.be.a('function');
  });
});
