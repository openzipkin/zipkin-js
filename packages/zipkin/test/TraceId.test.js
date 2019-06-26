const TraceId = require('../src/tracer/TraceId');
const {Some, None} = require('../src/option');

describe('TraceId', () => {
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

  it('parentSpanId should return None when absent', () => {
    const traceId = new TraceId({
      traceId: '863ac35c9f6413ad48485a3953bb6124',
      spanId: '48485a3953bb6124'
    });
    expect(traceId.parentSpanId).to.equal(None);
  });

  it('parentSpanId should return Some when present', () => {
    const traceId = new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c'
    });
    expect(traceId.parentSpanId.getOrElse()).to.equal('b');
  });

  it('old syntax: traceId can be left out', () => {
    const traceId = new TraceId({
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('48485a3953bb6124');
    expect(traceId.spanId).to.equal('48485a3953bb6124');
  });

  it('old syntax: traceId can be None', () => {
    const traceId = new TraceId({
      traceId: None,
      spanId: '48485a3953bb6124'
    });
    expect(traceId.traceId).to.equal('48485a3953bb6124');
    expect(traceId.spanId).to.equal('48485a3953bb6124');
  });

  it('old syntax: traceId can be Some', () => {
    const traceId = new TraceId({
      traceId: new Some('a'),
      spanId: 'b'
    });
    expect(traceId.traceId).to.equal('a');
    expect(traceId.spanId).to.equal('b');
  });

  it('old syntax: parentId should return spanId when absent', () => {
    const traceId = new TraceId({
      traceId: '863ac35c9f6413ad48485a3953bb6124',
      spanId: '48485a3953bb6124'
    });
    expect(traceId.parentId).to.equal(traceId.spanId);
  });

  it('old syntax: parentId should return value when present', () => {
    const traceId = new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c',
    });
    expect(traceId.parentId).to.equal('b');
  });

  it('old syntax: flags is 0 by default', () => {
    const traceId = new TraceId({
      traceId: 'a',
      spanId: 'c',
    });
    expect(traceId.flags).to.equal(0);
  });

  it('old syntax: debug can be set from flags', () => {
    const traceId = new TraceId({
      traceId: 'a',
      spanId: 'b',
      flags: 1
    });
    expect(traceId.isDebug()).to.equal(true);
  });

  it('old syntax: flags is 1 when debug', () => {
    const traceId = new TraceId({
      traceId: 'a',
      spanId: 'c',
      debug: true
    });
    expect(traceId.flags).to.equal(1);
  });
});
