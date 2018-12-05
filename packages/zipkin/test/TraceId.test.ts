const {Some} = require('../src/option');
const TraceId = require('../src/tracer/TraceId');

describe('TraceId', () => {
  it('should accept a 64bit trace id', () => {
    const traceId = new TraceId({
      traceId: new Some('48485a3953bb6124'),
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('48485a3953bb6124');
  });

  it('should accept a 128bit trace id', () => {
    const traceId = new TraceId({
      traceId: new Some('863ac35c9f6413ad48485a3953bb6124'),
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('863ac35c9f6413ad48485a3953bb6124');
  });
});
