const lolex = require('lolex');
const {TBinaryProtocol, TFramedTransport} = require('thrift');
const thriftTypes = require('../src/gen-nodejs/zipkinCore_types');
const serializeSpan = require('zipkin-encoder-thrift');
const TraceId = require('../src/tracer/TraceId');
const {
  MutableSpan,
  Endpoint,
  ZipkinAnnotation,
  BinaryAnnotation
} = require('../src/internalRepresentations');
const {Some, None} = require('../src/option');
const {now} = require('../src/time');

describe('JSON Formatting', () => {
  const serverSpan = new MutableSpan(new TraceId({
    traceId: new Some('a'),
    parentId: new Some('b'),
    spanId: 'c',
    sampled: None
  }));
  serverSpan.setName('GET');
  serverSpan.setServiceName('PortalService');

  const here = new Endpoint({host: 171520595, port: 8080});

  serverSpan.setEndpoint(here);
  serverSpan.addBinaryAnnotation(new BinaryAnnotation({
    key: 'warning',
    value: 'The cake is a lie',
    endpoint: here
  }));
  serverSpan.addAnnotation(new ZipkinAnnotation({
    timestamp: 1,
    endpoint: here,
    value: 'sr'
  }));
  serverSpan.addAnnotation(new ZipkinAnnotation({
    timestamp: 2,
    endpoint: here,
    value: 'ss'
  }));
  serverSpan.started = 1468441525803803;

  const expected = {
    traceId: 'a',
    name: 'GET',
    id: 'c',
    parentId: 'b',
    timestamp: 1468441525803803,
    annotations: [
      {
        endpoint: {
          serviceName: 'PortalService',
          ipv4: '10.57.50.83',
          port: 8080
        },
        timestamp: 1,
        value: 'sr'
      },
      {
        endpoint: {
          serviceName: 'PortalService',
          ipv4: '10.57.50.83',
          port: 8080,
        },
        timestamp: 2,
        value: 'ss'
      }
    ],
    binaryAnnotations: [
      {
        key: 'warning',
        value: 'The cake is a lie',
        endpoint: {
          serviceName: 'PortalService',
          ipv4: '10.57.50.83',
          port: 8080
        }
      }
    ]
  };

  it('should transform correctly from MutableSpan to JSON representation', () => {
    const spanJson = serverSpan.toJSON();
    expect(spanJson.traceId).to.equal(expected.traceId);
    expect(spanJson.name).to.equal(expected.name);
    expect(spanJson.id).to.equal(expected.id);
    expect(spanJson.parentId).to.equal(expected.parentId);
    expect(spanJson.annotations).to.deep.equal(expected.annotations);
    expect(spanJson.binaryAnnotations).to.deep.equal(expected.binaryAnnotations);
  });

  it('should not set timestamp or duration on server span', () => {
    const spanJson = serverSpan.toJSON();
    expect(spanJson.timestamp).to.equal(undefined);
    expect(spanJson.duration).to.equal(undefined);
  });

  it('should set timestamp and duration on client span', () => {
    const clock = lolex.install(12345678);

    const clientSpan = new MutableSpan(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    clientSpan.setName('GET');
    clientSpan.addAnnotation(new ZipkinAnnotation({
      timestamp: now(),
      value: 'cs'
    }));
    clock.tick(1.732123);
    clientSpan.addAnnotation(new ZipkinAnnotation({
      timestamp: now(),
      value: 'cr'
    }));

    const spanJson = clientSpan.toJSON();
    expect(spanJson.timestamp).to.equal(12345678000);
    expect(spanJson.duration).to.equal(1732); // truncates nanos!

    clock.uninstall();
  });

  it('should have minimum duration of 1 microsecond', () => {
    const clock = lolex.install(12345678);

    const clientSpan = new MutableSpan(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    clientSpan.setName('GET');
    clientSpan.addAnnotation(new ZipkinAnnotation({
      timestamp: now(),
      value: 'cs'
    }));
    clock.tick(0.000123);
    clientSpan.addAnnotation(new ZipkinAnnotation({
      timestamp: now(),
      value: 'cr'
    }));

    const spanJson = clientSpan.toJSON();
    expect(spanJson.timestamp).to.equal(12345678000);
    expect(spanJson.duration).to.equal(1); // rounds up!

    clock.uninstall();
  });

  it('should set server address on client span', () => {
    const clientSpan = new MutableSpan(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    clientSpan.setName('GET');
    clientSpan.setServerAddr(new Endpoint({
      serviceName: 'there',
      host: 171520596,
      port: 80
    }));

    const spanJson = clientSpan.toJSON();
    expect(spanJson.binaryAnnotations).to.deep.equal([
      {
        key: 'sa',
        value: true,
        endpoint: {
          serviceName: 'there',
          ipv4: '10.57.50.84',
          port: 80
        }
      }
    ]);
  });
});

describe('64-bit trace ID', () => {
  const serverSpan = new MutableSpan(new TraceId({
    traceId: new Some('000000000000162e'),
    spanId: '000000000000162e',
    sampled: None
  }));

  it('should opaquely write trace ID in JSON representation', () => {
    const spanJson = serverSpan.toJSON();
    expect(spanJson.traceId).to.equal(serverSpan.traceId.traceId);
  });

  it('should write trace ID as high and low numbers in Thrift representation', () => {
    const serialized = serializeSpan(serverSpan, null);

    const spanThrift = new thriftTypes.Span();
    spanThrift.read(new TBinaryProtocol(new TFramedTransport(serialized)));

    expect(spanThrift.trace_id_high).to.equal(null);
    expect(spanThrift.trace_id.toNumber(true)).to.equal(5678);
  });
});

describe('128-bit trace ID', () => {
  const serverSpan = new MutableSpan(new TraceId({
    traceId: new Some('00000000000004d2000000000000162e'),
    spanId: '000000000000162e',
    sampled: None
  }));

  it('should opaquely write trace ID in JSON representation', () => {
    const spanJson = serverSpan.toJSON();
    expect(spanJson.traceId).to.equal(serverSpan.traceId.traceId);
  });

  it('should write trace ID as high and low numbers in Thrift representation', () => {
    const serialized = serializeSpan(serverSpan, null);

    const spanThrift = new thriftTypes.Span();
    spanThrift.read(new TBinaryProtocol(new TFramedTransport(serialized)));

    expect(spanThrift.trace_id_high.toNumber(true)).to.equal(1234);
    expect(spanThrift.trace_id.toNumber(true)).to.equal(5678);
  });
});
