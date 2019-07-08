const {expect} = require('chai');
const {ExplicitContext, Tracer} = require('zipkin');

const rest = require('rest');
const {
  maybeMiddleware,
  newSpanRecorder,
  expectB3Headers,
  expectSpan
} = require('../../../test/testFixture');
const restInterceptor = require('../src/restInterceptor');

// NOTE: CujoJS/rest sends all http status to success callback
describe('CujoJS/rest instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let server;
  let baseURL = ''; // default to relative path, for browser-based tests

  before((done) => {
    const middleware = maybeMiddleware();
    if (middleware !== null) {
      server = middleware.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    } else { // Inside a browser
      done();
    }
  });

  after(() => {
    if (server) server.close();
  });

  let spans;
  let tracer;

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({
      ctxImpl: new ExplicitContext(),
      localServiceName: serviceName,
      recorder: newSpanRecorder(spans)
    });
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function getClient() {
    return rest.wrap(restInterceptor, {tracer, remoteServiceName});
  }

  function url(path) {
    return `${baseURL}${path}?index=10&count=300`;
  }

  function successSpan(path) {
    return ({
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '202'
      }
    });
  }

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    return getClient()(url(path))
      .then(response => expectB3Headers(popSpan(), JSON.parse(response.entity)));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return getClient()(url(path))
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should report 404 in tags', () => {
    const path = '/pathno';
    return getClient()(url(path))
      .then(() => expectSpan(popSpan(), {
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'http.path': path,
          'http.status_code': '404',
          error: '404'
        }
      }));
  });

  it('should report 400 in tags', () => {
    const path = '/weather/securedTown';
    return getClient()(url(path))
      .then(() => expectSpan(popSpan(), {
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'http.path': path,
          'http.status_code': '400',
          error: '400'
        }
      }));
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    return getClient()(url(path))
      .then(() => expectSpan(popSpan(), {
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'http.path': path,
          'http.status_code': '500',
          error: '500'
        }
      }));
  });
});
