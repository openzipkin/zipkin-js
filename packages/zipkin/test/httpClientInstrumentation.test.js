const sinon = require('sinon');
const Tracer = require('../src/tracer');
const ExplicitContext = require('../src/explicit-context');
const HttpClient = require('../src/instrumentation/httpClient');

describe('Http Client Instrumentation', () => {
  it('should add headers to requests', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder});
    const instrumentation = new HttpClient({
      tracer,
      serviceName: 'weather-app',
      remoteServiceName: 'weather-forecast-service'});

    const url = 'http://127.0.0.1:80/weather?index=10&count=300';
    tracer.scoped(() => {
      instrumentation.recordRequest({}, url, 'GET');
      instrumentation.recordResponse(tracer.id, '202');
    });
    const annotations = record.args.map(args => args[0]);
    const initialTraceId = annotations[0].traceId.traceId;
    annotations.forEach(ann => expect(ann.traceId.traceId)
      .to.equal(initialTraceId).and
      .to.have.lengthOf(16));

    expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
    expect(annotations[0].annotation.serviceName).to.equal('weather-app');

    expect(annotations[1].annotation.annotationType).to.equal('Rpc');
    expect(annotations[1].annotation.name).to.equal('GET');

    expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[2].annotation.key).to.equal('http.url');
    expect(annotations[2].annotation.value).to.equal(url);

    expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

    expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');
    expect(annotations[4].annotation.serviceName).to.equal('weather-forecast-service');

    expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[5].annotation.key).to.equal('http.status_code');
    expect(annotations[5].annotation.value).to.equal('202');

    expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');
  });

  it('should record an error', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder});
    const instrumentation = new HttpClient({
      tracer,
      serviceName: 'weather-app',
      remoteServiceName: 'weather-forecast-service'});

    const url = 'http://127.0.0.1:80/weather?index=10&count=300';
    tracer.scoped(() => {
      instrumentation.recordRequest({}, url, 'GET');
      instrumentation.recordError(tracer.id, new Error('nasty error'));
    });
    const annotations = record.args.map(args => args[0]);
    const initialTraceId = annotations[0].traceId.traceId;
    annotations.forEach(ann => expect(ann.traceId.traceId)
      .to.equal(initialTraceId).and
      .to.have.lengthOf(16));

    expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[5].annotation.key).to.equal('error');
    expect(annotations[5].annotation.value).to.equal('Error: nasty error');
  });
});
