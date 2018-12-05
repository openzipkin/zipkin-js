const TraceId = require('../src/tracer/TraceId');
const {Span, Endpoint} = require('../src/model');
const {JSON_V1} = require('../src/jsonEncoder');
const {Some, None} = require('../src/option');

describe('JSON v1 Formatting', () => {
  // v1 format requires an empty span name. v2 can leave it out
  it('should write minimum fields, notably an empty span name', () => {
    const span = new Span(new TraceId({
      traceId: new Some('000000000000162e'),
      spanId: '000000000000162e',
      sampled: None
    }));

    expect(JSON_V1.encode(span)).to.equal(
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

    expect(JSON_V1.encode(span)).to.contain(
      '{"traceId":"000000000000162e","parentId":"000000000000abcd"'
    );
  });

  it('should write a 128-bit trace ID', () => {
    const span = new Span(new TraceId({
      traceId: new Some('00000000000004d2000000000000162e'),
      spanId: '000000000000162e'
    }));

    expect(JSON_V1.encode(span)).to.contain(
      '{"traceId":"00000000000004d2000000000000162e"'
    );
  });

  it('should write a debug flag', () => {
    const span = new Span(new TraceId({
      traceId: new Some('00000000000004d2000000000000162e'),
      spanId: '000000000000162e',
      flags: 1
    }));

    expect(JSON_V1.encode(span)).to.contain(',"debug":true}');
  });

  it('should transform correctly from Span to JSON representation', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    span.setName('GET');
    span.setLocalEndpoint(new Endpoint({
      serviceName: 'PortalService',
      ipv4: '10.57.50.83',
      port: 8080
    }));
    span.setKind('SERVER');
    span.setTimestamp(1);
    span.setDuration(1);
    span.putTag('warning', 'The cake is a lie');
    span.setShared(true);

    const expected = {
      traceId: 'a',
      name: 'get',
      id: 'c',
      parentId: 'b',
      annotations: [
        {
          endpoint: {
            serviceName: 'portalservice',
            ipv4: '10.57.50.83',
            port: 8080
          },
          timestamp: 1,
          value: 'sr'
        },
        {
          endpoint: {
            serviceName: 'portalservice',
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
            serviceName: 'portalservice',
            ipv4: '10.57.50.83',
            port: 8080
          }
        }
      ]
    };

    const spanJson = JSON.parse(JSON_V1.encode(span));
    expect(spanJson.traceId).to.equal(expected.traceId);
    expect(spanJson.name).to.equal(expected.name);
    expect(spanJson.id).to.equal(expected.id);
    expect(spanJson.parentId).to.equal(expected.parentId);
    expect(spanJson.annotations).to.deep.equal(expected.annotations);
    expect(spanJson.binaryAnnotations).to.deep.equal(expected.binaryAnnotations);
  });

  it('should not set timestamp or duration on shared span', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    span.setName('GET');
    span.setKind('SERVER');
    span.setTimestamp(1);
    span.setDuration(1);
    span.setShared(true);

    const spanJson = JSON_V1.encode(span);

    expect(spanJson).to.not.contain('"name":"GET","timestamp"');
    expect(spanJson).to.not.contain('"duration"');
  });

  it('should set timestamp and duration on client span', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    span.setName('GET');
    span.setKind('CLIENT');
    span.setTimestamp(1);
    span.setDuration(1);

    expect(JSON_V1.encode(span)).to.contain('"timestamp":1,"duration":1,');
  });

  it('should set server address on client span', () => {
    const span = new Span(new TraceId({
      traceId: new Some('a'),
      parentId: new Some('b'),
      spanId: 'c',
      sampled: None
    }));
    span.setName('GET');
    span.setKind('CLIENT');
    span.setRemoteEndpoint(new Endpoint({
      serviceName: 'there',
      ipv4: '10.57.50.84',
      port: 80
    }));

    const spanJson = JSON_V1.encode(span);
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

    const spanJson = JSON_V1.encode(span);
    expect(spanJson).to.contain(
      '"binaryAnnotations":[{"key":"http.path","value":"/api"}]}'
    );
  });
});
