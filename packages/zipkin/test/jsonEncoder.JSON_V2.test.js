const TraceId = require('../src/tracer/TraceId');
const {Span, Endpoint} = require('../src/model');
const {JSON_V2} = require('../src/jsonEncoder');
const {Some} = require('../src/option');

describe('JSON v2 Formatting', () => {
  it('should write minimum fields', () => {
    const span = new Span(new TraceId({
      spanId: '000000000000162e'
    }));

    expect(JSON_V2.encode(span)).to.equal(
      '{"traceId":"000000000000162e","id":"000000000000162e"}'
    );
  });

  it('should write a parent ID when present', () => {
    const span = new Span(new TraceId({
      traceId: '000000000000162e',
      parentId: new Some('000000000000abcd'),
      spanId: '000000000000efgh'
    }));

    expect(JSON_V2.encode(span)).to.contain(
      '{"traceId":"000000000000162e","parentId":"000000000000abcd"'
    );
  });

  it('should write a 128-bit trace ID', () => {
    const span = new Span(new TraceId({
      traceId: '00000000000004d2000000000000162e',
      spanId: '000000000000162e'
    }));

    expect(JSON_V2.encode(span)).to.contain(
      '{"traceId":"00000000000004d2000000000000162e"'
    );
  });

  it('should write a debug flag', () => {
    const span = new Span(new TraceId({
      traceId: '00000000000004d2000000000000162e',
      spanId: '000000000000162e',
      debug: true
    }));

    expect(JSON_V2.encode(span)).to.contain(',"debug":true}');
  });

  it('should transform correctly from Span to JSON representation', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c'
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

    const expected = {
      traceId: 'a',
      name: 'get',
      id: 'c',
      parentId: 'b',
      kind: 'SERVER',
      timestamp: 1,
      duration: 1,
      localEndpoint: {
        serviceName: 'portalservice',
        ipv4: '10.57.50.83',
        port: 8080
      },
      tags: {warning: 'The cake is a lie'}
    };

    const spanJson = JSON.parse(JSON_V2.encode(span));
    expect(spanJson.traceId).to.equal(expected.traceId);
    expect(spanJson.parentId).to.equal(expected.parentId);
    expect(spanJson.id).to.equal(expected.id);
    expect(spanJson.name).to.equal(expected.name);
    expect(spanJson.kind).to.equal(expected.kind);
    expect(spanJson.timestamp).to.equal(expected.timestamp);
    expect(spanJson.duration).to.equal(expected.duration);
    expect(spanJson.tags).to.deep.equal(expected.tags);
  });

  it('should set shared', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c',
      shared: true
    }));

    const spanJson = JSON_V2.encode(span);

    expect(spanJson).to.contain('"shared":true');
  });

  it('should set timestamp and duration on client span', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c'
    }));
    span.setName('GET');
    span.setKind('CLIENT');
    span.setTimestamp(1);
    span.setDuration(1);

    expect(JSON_V2.encode(span)).to.contain('"timestamp":1,"duration":1}');
  });

  it('should set remoteEndpoint on client span', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c'
    }));
    span.setName('GET');
    span.setKind('CLIENT');
    span.setRemoteEndpoint(new Endpoint({
      serviceName: 'there',
      ipv4: '10.57.50.84',
      port: 80
    }));

    const spanJson = JSON_V2.encode(span);
    expect(spanJson).to.contain(
      '"remoteEndpoint":{"serviceName":"there","ipv4":"10.57.50.84","port":80}}'
    );
  });

  // make sure nothing strange happens like object interpretation of dots
  it('should serialize tags with dotted names', () => {
    const span = new Span(new TraceId({
      traceId: 'a',
      parentId: new Some('b'),
      spanId: 'c'
    }));
    span.setName('GET');
    span.putTag('http.path', '/api');

    const spanJson = JSON_V2.encode(span);
    expect(spanJson).to.contain('"tags":{"http.path":"/api"}}');
  });
});
