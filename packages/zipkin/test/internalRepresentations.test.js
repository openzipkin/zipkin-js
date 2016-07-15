const TraceId = require('../src/tracer/TraceId');
const {
  MutableSpan,
  Endpoint,
  ZipkinAnnotation,
  BinaryAnnotation
} = require('../src/internalRepresentations');
const {Some, None} = require('../src/option');

describe('JSON Formatting', () => {
  const ms = new MutableSpan(new TraceId({
    traceId: new Some('a'),
    parentId: new Some('b'),
    spanId: 'c',
    sampled: None
  }));
  ms.setName('GET');
  ms.setServiceName('PortalService');

  const here = new Endpoint({host: 171520595, port: 8080});

  ms.setEndpoint(here);
  ms.addBinaryAnnotation(new BinaryAnnotation({
    key: 'warning',
    value: 'The cake is a lie',
    endpoint: here
  }));
  ms.addAnnotation(new ZipkinAnnotation({
    timestamp: 1,
    endpoint: here,
    value: 'sr'
  }));
  ms.addAnnotation(new ZipkinAnnotation({
    timestamp: 2,
    endpoint: here,
    value: 'ss'
  }));
  ms.started = 1468441525803803;

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
    const spanJson = ms.toJSON();
    expect(spanJson.traceId).to.equal(expected.traceId);
    expect(spanJson.name).to.equal(expected.name);
    expect(spanJson.id).to.equal(expected.id);
    expect(spanJson.parentId).to.equal(expected.parentId);
    expect(spanJson.annotations).to.deep.equal(expected.annotations);
    expect(spanJson.binaryAnnotations).to.deep.equal(expected.binaryAnnotations);
  });
});
