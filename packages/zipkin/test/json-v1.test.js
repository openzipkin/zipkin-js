const lolex = require('lolex');
const TraceId = require('../src/tracer/TraceId');
const {Span, Endpoint} = require('../src/record');
const toJsonV1 = require('../src/json-v1');
const {Some, None} = require('../src/option');
const {now} = require('../src/time');

describe('JSON v1 Formatting', () => {
  // v1 format requires an empty span name. v2 can leave it out
  it('should write minimum fields, notably an empty span name', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      spanId: '000000000000162e',
      sampled: None
    }));

    expect(toJsonV1(span)).to.equal(
      '{"traceId":"000000000000162e","id":"000000000000162e","name":""}'
    );
  });

  it('should write a parent ID when present', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      parentId: new Some('000000000000abcd'),
      spanId: '000000000000efgh',
      sampled: None
    }));

    expect(toJsonV1(span)).to.contain(
      '{"traceId":"000000000000162e","parentId":"000000000000abcd"'
    );
  });

  it('should write a 128-bit trace ID', () => {
    const span = new Span(new TraceId({
      traceId: new Some('00000000000004d2000000000000162e'),
      spanId: '000000000000162e'
    }));

    expect(toJsonV1(span)).to.contain(
      '{"traceId":"00000000000004d2000000000000162e"'
    );
  });

  it('should write a debug flag', () => {
    const span = new Span(new TraceId({
      traceId: new Some('00000000000004d2000000000000162e'),
      spanId: '000000000000162e',
      flags: 1
    }));

    expect(toJsonV1(span)).to.contain(',"debug":true}');
  });

  it('should transform correctly from Span to JSON representation', () => {
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

    const expected = {
      traceId: 'a',
      name: 'GET',
      id: 'c',
      parentId: 'b',
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

    const spanJson = JSON.parse(toJsonV1(serverSpan));
    expect(spanJson.traceId).to.equal(expected.traceId);
    expect(spanJson.name).to.equal(expected.name);
    expect(spanJson.id).to.equal(expected.id);
    expect(spanJson.parentId).to.equal(expected.parentId);
    expect(spanJson.annotations).to.deep.equal(expected.annotations);
    expect(spanJson.binaryAnnotations).to.deep.equal(expected.binaryAnnotations);
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

    const spanJson = toJsonV1(serverSpan);

    expect(spanJson).to.not.contain('"name":"GET","timestamp"');
    expect(spanJson).to.not.contain('"duration"');
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
    clientSpan.addAnnotation(now(), 'cs');
    clock.tick(1.732123);
    clientSpan.addAnnotation(now(), 'cr');

    expect(toJsonV1(clientSpan)).to.contain(
      '"timestamp":12345678000,"duration":1732,' // truncates nanos
    );

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
    clientSpan.addAnnotation(now(), 'cs');
    clock.tick(0.000123);
    clientSpan.addAnnotation(now(), 'cr');

    expect(toJsonV1(clientSpan)).to.contain(
      '"timestamp":12345678000,"duration":1,' // rounds up!
    );

    clock.uninstall();
  });

  it('should set server address on client span', () => {
    const clientSpan = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    clientSpan.setName('GET');
    clientSpan.setRemoteEndpoint(new Endpoint({
      serviceName: 'there',
      ipv4: '10.57.50.84',
      port: 80
    }));

    const spanJson = toJsonV1(clientSpan);
    expect(spanJson).to.contain(
      '{"key":"sa","value":true,"endpoint":{"serviceName":"there","ipv4":"10.57.50.84","port":80}}'
    );
  });

  // make sure nothing strange happens like object interpretation of dots
  it('should serialize tags with dotted names as binary annotations', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    span.setName('GET');
    span.putTag('http.path', '/api');

    const spanJson = toJsonV1(span);
    expect(spanJson).to.contain(
      '"binaryAnnotations":[{"key":"http.path","value":"/api"}]}'
    );
  });
});
