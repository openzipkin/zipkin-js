const TraceId = require('../src/tracer/TraceId');
const {Span, Endpoint} = require('../src/model');
const {Some} = require('../src/option');

describe('Endpoint setters', () => {
  // Zipkin does this, so doing so early alerts users
  it('should lowercase serviceName', () => {
    const endpoint = new Endpoint({
      serviceName: 'Unknown'
    });
    expect(endpoint.serviceName).to.equal('unknown');
  });
});

describe('Span setters', () => {
  // Zipkin does this, so doing so early alerts users
  it('should lowercase name', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      spanId: 'b',
    }));
    span.setName('StarWars');
    expect(span.name).to.equal('starwars');
  });

  // otherwise people can't find their spans
  it('span.setLocalEndpoint() should accept unknown serviceName', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      spanId: 'b',
    }));
    span.setLocalEndpoint(new Endpoint({
      serviceName: 'unknown'
    }));
    expect(span.localEndpoint.serviceName).to.equal('unknown');
  });

  it('should not set empty endpoints', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      spanId: 'b',
    }));
    span.setLocalEndpoint(new Endpoint({}));
    span.setRemoteEndpoint(new Endpoint({}));

    expect(span.localEndpoint).to.equal(undefined);
    expect(span.remoteEndpoint).to.equal(undefined);
  });

  it('should set minimum duration of 1 microsecond', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      spanId: 'b',
    }));
    span.setDuration(0.77);

    expect(span.duration).to.equal(1);
  });
});
