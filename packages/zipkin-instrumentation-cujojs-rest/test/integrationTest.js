const rest = require('rest');
const restInterceptor = require('../src/restInterceptor');

const {expectB3Headers, setupTestServer, setupTestTracer} = require('../../../test/testFixture');

// NOTE: CujoJS/rest sends all http status to success callback
describe('CujoJS/rest instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();
  const tracer = setupTestTracer({localServiceName: serviceName});

  function getClient() {
    return rest.wrap(restInterceptor, {tracer: tracer.tracer(), remoteServiceName});
  }

  function successSpan(path) {
    return ({
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '200'
      }
    });
  }

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    return getClient()(server.url(path))
      .then(response => expectB3Headers(tracer.popSpan(), JSON.parse(response.entity)));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return getClient()(server.url(path))
      .then(() => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should report 404 in tags', () => {
    const path = '/pathno';
    return getClient()(server.url(path))
      .then(() => tracer.expectNextSpanToEqual({
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

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    return getClient()(server.url(path))
      .then(() => tracer.expectNextSpanToEqual({
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'http.path': path,
          'http.status_code': '401',
          error: '401'
        }
      }));
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    return getClient()(server.url(path))
      .then(() => tracer.expectNextSpanToEqual({
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
