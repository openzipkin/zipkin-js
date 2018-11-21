import { expect } from 'chai';
import { ExplicitContext, Tracer } from 'zipkin';

describe('Tracer', () => {
  it('should have correct type', () => {
    const recorder = {
      record: () => {}
    };
    const ctxImpl = new ExplicitContext();
    const tracer: Tracer = new Tracer({ctxImpl, recorder});

    expect(tracer.recordRpc).to.be.a('function');
  });
});
