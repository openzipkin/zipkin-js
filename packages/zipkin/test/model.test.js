const TraceId = require('../src/tracer/TraceId');
const {Span, Endpoint} = require('../src/model');

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
      traceId: 'a',
      spanId: 'b',
    }));
    span.setName('StarWars');
    expect(span.name).to.equal('starwars');
  });

  // otherwise people can't find their spans
  it('span.setLocalEndpoint() should accept unknown serviceName', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      spanId: 'b',
    }));
    span.setLocalEndpoint(new Endpoint({
      serviceName: 'unknown'
    }));
    expect(span.localEndpoint.serviceName).to.equal('unknown');
  });

  it('should not set empty endpoints', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      spanId: 'b',
    }));
    span.setLocalEndpoint(new Endpoint({}));
    span.setRemoteEndpoint(new Endpoint({}));

    expect(span.localEndpoint).to.equal(undefined);
    expect(span.remoteEndpoint).to.equal(undefined);
  });

  it('should set minimum duration of 1 microsecond', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      spanId: 'b',
    }));
    span.setDuration(0.77);

    expect(span.duration).to.equal(1);
  });

  const annotationTypesCases = [[10, '10'], [true, 'true'], [{}], [[]]];

  annotationTypesCases.forEach(([annotationValue, expectedValue]) => {
    it(`should convert ${typeof annotationValue} annotation values to strings`, () => {
      const span = new Span(new TraceId({
        traceId: 'a',
        spanId: 'b',
      }));
      span.addAnnotation(101239, annotationValue);

      if (expectedValue !== undefined) {
        expect(span.annotations[0].value).to.equal(expectedValue);
      }
    });
  });

  const tagTypesCases = [[10, '10'], [true, 'true'], [{}], [[]]];

  tagTypesCases.forEach(([tagValue, expectedValue]) => {
    it(`should convert ${typeof tagValue} tag values to strings`, () => {
      const span = new Span(new TraceId({
        traceId: 'a',
        spanId: 'b',
      }));
      span.putTag('c', tagValue);

      if (expectedValue !== undefined) {
        expect(span.tags.c).to.equal(expectedValue);
      }
    });
  });
});
