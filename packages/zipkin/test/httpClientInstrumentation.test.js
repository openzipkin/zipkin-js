const BatchRecorder = require('../src/batch-recorder');
const ExplicitContext = require('../src/explicit-context');
const HttpClient = require('../src/instrumentation/httpClient');
const {JSON_V2} = require('../src/jsonEncoder');
const Tracer = require('../src/tracer');
const {expectB3Headers, expectSpan} = require('../../../test/testFixture');

describe('Http Client Instrumentation', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';
  const baseURL = 'http://127.0.0.1:80';

  let spans;
  let tracer;
  let instrumentation;

  beforeEach(() => { // TODO: extract this logic as it is reused in tracer, client and server tests
    spans = [];
    tracer = new Tracer({
      ctxImpl: new ExplicitContext(),
      localServiceName: serviceName,
      recorder: new BatchRecorder({
        logger: {
          logSpan: (span) => {
            spans.push(JSON.parse(JSON_V2.encode(span)));
          }
        }
      })
    });
    instrumentation = new HttpClient({tracer, remoteServiceName});
  });

  afterEach(() => expect(spans).to.be.empty);

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function url(path) {
    return `${baseURL}${path}?index=10&count=300`;
  }

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    const request = instrumentation.recordRequest({}, url(path), 'GET');
    instrumentation.recordResponse(tracer.id, '202');

    expectB3Headers(popSpan(), request.headers, false);
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';

    instrumentation.recordRequest({}, url(path), 'GET');
    instrumentation.recordResponse(tracer.id, '200');

    expectSpan(popSpan(), {
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '200' // TODO: It isn't typical to add status on 200
      }
    });
  });

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    instrumentation.recordRequest({}, url(path), 'GET');
    instrumentation.recordResponse(tracer.id, '401');

    expectSpan(popSpan(), {
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '401',
        error: '401'
      }
    });
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    instrumentation.recordRequest({}, url(path), 'GET');
    instrumentation.recordResponse(tracer.id, '500');

    expectSpan(popSpan(), {
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '500',
        error: '500'
      }
    });
  });

  it('should record an error in tags', () => {
    const path = '/weather/bagCity';
    instrumentation.recordRequest({}, url(path), 'GET');
    instrumentation.recordError(tracer.id, new Error('nasty error'));

    expectSpan(popSpan(), {
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        error: 'Error: nasty error'
      }
    });
  });
});
