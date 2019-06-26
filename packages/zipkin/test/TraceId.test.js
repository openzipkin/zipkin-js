const TraceId = require('../src/tracer/TraceId');
const {Some, None} = require('../src/option');

describe('TraceId', () => {
  it('should accept old syntax where traceId can be left out', () => {
    const traceId = new TraceId({
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('48485a3953bb6124');
    expect(traceId.spanId).to.equal('48485a3953bb6124');
  });

  it('should accept old syntax where traceId can be None', () => {
    const traceId = new TraceId({
      traceId: None,
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('48485a3953bb6124');
    expect(traceId.spanId).to.equal('48485a3953bb6124');
  });

  it('should accept old syntax where traceId can be Some', () => {
    const traceId = new TraceId({
      traceId: new Some('a'),
      spanId: 'b'
    });
    expect(traceId.traceId).to.equal('a');
    expect(traceId.spanId).to.equal('b');
  });

  it('should accept a 64bit trace id', () => {
    const traceId = new TraceId({
      traceId: '48485a3953bb6124',
      spanId: '863ac35c9f6413ad'
    });
    expect(traceId.traceId).to.equal('48485a3953bb6124');
    expect(traceId.spanId).to.equal('863ac35c9f6413ad');
  });

  it('should accept a 128bit trace id', () => {
    const traceId = new TraceId({
      traceId: '863ac35c9f6413ad48485a3953bb6124',
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('863ac35c9f6413ad48485a3953bb6124');
  });
});
