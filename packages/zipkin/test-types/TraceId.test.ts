import { expect } from 'chai';
import { option, TraceId } from 'zipkin';

describe('TraceId', () => {
  it('should have correct type', () => {
    const traceId: TraceId = new TraceId({
      traceId: '1',
      parentId: new option.Some('1'),
      spanId: '2'
    });

    expect(traceId.isShared()).to.equal(false);

    const sampled: option.IOption<boolean> = traceId.sampled;
    expect(sampled.map).to.be.a('function');
    expect(sampled).to.equal(option.None);

    const parentId: option.IOption<string> = traceId.parentSpanId;
    expect(parentId.map).to.be.a('function');
  });
});
