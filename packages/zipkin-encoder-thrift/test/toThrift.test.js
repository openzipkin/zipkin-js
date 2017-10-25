const lolex = require('lolex');
const toThrift = require('../src');
const thriftTypes = require('../src/gen-nodejs/zipkinCore_types');
const {
  TFramedTransport,
  TBufferedTransport,
  TBinaryProtocol
} = require('thrift');
const {
  TraceId,
  record: {Span, Endpoint},
  option: {Some, None}
} = require('zipkin');

function serialize(spanThrift) {
  let serialized;
  const transport = new TBufferedTransport(null, (res) => {
    serialized = res;
  });
  const protocol = new TBinaryProtocol(transport);
  spanThrift.write(protocol);
  protocol.flush();
  return serialized;
}

function deserialize(serialized) {
  const res = new thriftTypes.Span();
  res.read(new TBinaryProtocol(new TFramedTransport(serialized)));
  return res;
}

describe('Thrift v1 Formatting', () => {
  // The Thrift IDL has camel_cased variable names, so we need camel-casing
  // jshint camelcase: false

  // v1 format requires an empty span name. v2 can leave it out
  it('should write minimum fields, notably an empty span name', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      spanId: '000000000000162e',
      sampled: None
    }));

    const expected = new thriftTypes.Span();
    expected.trace_id = '000000000000162e';
    expected.id = '000000000000162e';
    expected.name = '';

    expect(toThrift(span)).to.deep.equal(serialize(expected));
  });

  it('should write a parent ID when present', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      parentId: new Some('000000000000abcd'),
      spanId: '000000000000efgh',
      sampled: None
    }));

    const expected = new thriftTypes.Span();
    expected.trace_id = '000000000000162e';
    expected.parent_id = '000000000000abcd';
    expected.id = '000000000000efgh';
    expected.name = '';

    expect(toThrift(span)).to.deep.equal(serialize(expected));
  });

  it('should write trace ID high when input is a 128-bit trace ID', () => {
    const span = new Span(new TraceId({
      traceId: new Some('00000000000004d2000000000000162e'),
      spanId: '000000000000162e'
    }));

    const expected = new thriftTypes.Span();
    expected.trace_id_high = '00000000000004d2';
    expected.trace_id = '000000000000162e';
    expected.id = '000000000000162e';
    expected.name = '';

    expect(toThrift(span)).to.deep.equal(serialize(expected));
  });

  it('should write a debug flag', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      spanId: '000000000000162e',
      flags: 1
    }));

    const expected = new thriftTypes.Span();
    expected.trace_id = '000000000000162e';
    expected.id = '000000000000162e';
    expected.name = '';
    expected.debug = true;

    expect(toThrift(span)).to.deep.equal(serialize(expected));
  });

  it('should transform correctly from Span to Thrift representation', () => {
    const serverSpan = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    serverSpan.setName('GET');
    serverSpan.setLocalServiceName('PortalService');
    serverSpan.setLocalIpV4('10.57.50.83');
    serverSpan.setLocalPort(8080);
    serverSpan.setShared(true);
    serverSpan.putTag('warning', 'The cake is a lie');
    serverSpan.addAnnotation(1, 'sr');
    serverSpan.addAnnotation(2, 'ss');
    serverSpan.started = 1468441525803803;

    const expectedHost = new thriftTypes.Endpoint({
      service_name: 'PortalService',
      ipv4: 171520595,
      port: 8080
    });
    const expected = new thriftTypes.Span();
    expected.trace_id = 'a';
    expected.parent_id = 'b';
    expected.id = 'c';
    expected.name = 'GET';
    expected.annotations = [
      new thriftTypes.Annotation({
        timestamp: 1,
        value: 'sr',
        host: expectedHost
      }),
      new thriftTypes.Annotation({
        timestamp: 2,
        value: 'ss',
        host: expectedHost
      })
    ];
    expected.binary_annotations = [
      new thriftTypes.BinaryAnnotation({
        key: 'warning',
        value: 'The cake is a lie',
        annotation_type: thriftTypes.AnnotationType.STRING,
        host: expectedHost,
      })
    ];
    const serialized = toThrift(serverSpan);

    expect(serialized).to.deep.equal(serialize(expected));
  });

  it('should not set timestamp or duration on shared span', () => {
    const serverSpan = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    serverSpan.setName('GET');
    serverSpan.setShared(true);
    serverSpan.addAnnotation(1, 'sr');
    serverSpan.addAnnotation(2, 'ss');

    const spanThrift = deserialize(toThrift(serverSpan));

    expect(spanThrift.timestamp).to.equal(null);
    expect(spanThrift.duration).to.equal(null);
  });

  it('should set timestamp and duration on client span', () => {
    const clock = lolex.install(12345678);

    const clientSpan = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    clientSpan.setName('GET');
    clientSpan.addAnnotation(Date.now() * 1000, 'cs');
    clock.tick(1.732123);
    clientSpan.addAnnotation(Date.now() * 1000, 'cr');

    const spanThrift = deserialize(toThrift(clientSpan));
    expect(spanThrift.timestamp.toNumber()).to.equal(12345678000);
    expect(spanThrift.duration.toNumber()).to.equal(1732); // truncates nanos!

    clock.uninstall();
  });

  it('should have minimum duration of 1 microsecond', () => {
    const clock = lolex.install(12345678);

    const clientSpan = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    clientSpan.setName('GET');
    clientSpan.addAnnotation(Date.now() * 1000, 'cs');
    clock.tick(0.000123);
    clientSpan.addAnnotation(Date.now() * 1000, 'cr');

    const spanThrift = deserialize(toThrift(clientSpan));
    expect(spanThrift.timestamp.toNumber()).to.equal(12345678000);
    expect(spanThrift.duration.toNumber()).to.equal(1); // rounds up!

    clock.uninstall();
  });

  it('should set server address on client span', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      spanId: '000000000000162e'
    }));
    span.setName('GET');
    span.setRemoteEndpoint(new Endpoint({
      serviceName: 'there',
      ipv4: '10.57.50.84',
      port: 80
    }));

    const expected = new thriftTypes.Span();
    expected.trace_id = '000000000000162e';
    expected.id = '000000000000162e';
    expected.name = 'GET';
    expected.binary_annotations = [
      new thriftTypes.BinaryAnnotation({
        key: 'sa',
        value: Buffer.from([1]),
        annotation_type: thriftTypes.AnnotationType.BOOL,
        host: new thriftTypes.Endpoint({
          service_name: 'there',
          ipv4: 171520596,
          port: 80
        }),
      })
    ];

    expect(toThrift(span)).to.deep.equal(serialize(expected));
  });

  // make sure nothing strange happens like object interpretation of dots
  it('should serialize tags with dotted names as binary annotations', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      spanId: '000000000000162e'
    }));
    span.setName('GET');
    span.putTag('http.path', '/api');

    const expected = new thriftTypes.Span();
    expected.trace_id = '000000000000162e';
    expected.id = '000000000000162e';
    expected.name = 'GET';
    expected.binary_annotations = [
      new thriftTypes.BinaryAnnotation({
        key: 'http.path',
        value: Buffer.from('/api'),
        annotation_type: thriftTypes.AnnotationType.STRING
      })
    ];

    expect(toThrift(span)).to.deep.equal(serialize(expected));
  });
});
