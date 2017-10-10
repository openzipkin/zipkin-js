const TraceId = require('../../zipkin/src/tracer/TraceId');
const serializeSpan = require('../src');
const {
  MutableSpan,
  Endpoint,
  ZipkinAnnotation,
  BinaryAnnotation
} = require('../../zipkin/src/internalRepresentations');
const {Some, None} = require('../../zipkin/src/option');

describe('Serialising a span', () => {
  // The Thrift IDL has camel_cased variable names, so we need camel-casing
  // jshint camelcase: false

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

  const expected =
    'CgABAAAAAAAAAAoLAAMAAAADR0VUCgAEAAAAAAAAAAwKAAUAA' +
    'AAAAAAACw8ABgwAAAACCgABAAAAAAAAAAELAAIAAAACc3IMAA' +
    'MIAAEKOTJTBgACH5ALAAMAAAANUG9ydGFsU2VydmljZQAACgA' +
    'BAAAAAAAAAAILAAIAAAACc3MMAAMIAAEKOTJTBgACH5ALAAMA' +
    'AAANUG9ydGFsU2VydmljZQAADwAIDAAAAAELAAEAAAAHd2Fyb' +
    'mluZwsAAgAAABFUaGUgY2FrZSBpcyBhIGxpZQgAAwAAAAYMAA' +
    'QIAAEKOTJTBgACH5ALAAMAAAANUG9ydGFsU2VydmljZQAAAgA' +
    'JAAA=';

  it('should serialize correctly from MutableSpan to base64 encoded representation', () => {
    const serialized = serializeSpan(ms);
    expect(serialized).to.equal(expected);
  });
});
