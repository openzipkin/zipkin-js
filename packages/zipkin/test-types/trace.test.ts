import { Tracer, ExplicitContext } from 'zipkin';
import { expect } from 'chai';

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
