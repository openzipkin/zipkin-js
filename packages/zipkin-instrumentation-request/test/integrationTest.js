const request = require('request');
const wrapRequest = require('../src/index');

const {expectB3Headers, setupTestServer, setupTestTracer} = require('../../../test/testFixture');

describe('request instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();
  const tracer = setupTestTracer({localServiceName: serviceName});

  function getClient() {
    return wrapRequest(request, {tracer: tracer.tracer(), remoteServiceName});
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
    getClient().get(server.url(path)).on('body', body => expectB3Headers(tracer.popSpan(), body));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    getClient().get(server.url(path), () => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should support options request', () => {
    const path = '/weather/wuhan';
    getClient()({url: server.url(path)}, () => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should report 404 in tags', () => {
    const path = '/pathno';
    getClient().get(server.url(path)).on('response', () => tracer.expectNextSpanToEqual({
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
    getClient().get(server.url(path)).on('response', () => tracer.expectNextSpanToEqual({
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
    getClient().get(server.url(path)).on('response', () => tracer.expectNextSpanToEqual({
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

  it('should report when endpoint doesnt exist in tags', (done) => {
    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    getClient().get({url: badUrl, timeout: 300})
      .on('error', (error) => {
        tracer.expectNextSpanToEqual({
          name: 'get',
          kind: 'CLIENT',
          localEndpoint: {serviceName},
          remoteEndpoint: {serviceName: remoteServiceName},
          tags: {
            'http.path': path,
            error: error.toString()
          }
        });
        done();
      })
      .on('response', response => new Error(`expected an invalid host to error. status: ${response.status}`));
  });

  it('should support nested get requests', () => {
    const client = getClient();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    client.get(server.url(beijing), () => client.get(server.url(wuhan), () => {
      // since these are blocking requests, we should have an expected order
      tracer.expectNextSpanToEqual(successSpan(wuhan));
      tracer.expectNextSpanToEqual(successSpan(beijing));
    }));
  });
});
