const {expect} = require('chai');
const {ExplicitContext, Tracer} = require('zipkin');

const request = require('request');
const {
  expectB3Headers,
  expectSpan,
  newSpanRecorder,
  setupTestServer
} = require('../../../test/testFixture');
const wrapRequest = require('../src/index');

describe('request instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();

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
    return wrapRequest(request, {tracer, remoteServiceName});
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
    return getClient().get(server.url(path))
      .on('body', body => expectB3Headers(popSpan(), body));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return getClient().get(server.url(path), () => expectSpan(popSpan(), successSpan(path)));
  });

  it('should support options request', () => {
    const path = '/weather/wuhan';
    return getClient()({url: server.url(path)}, () => expectSpan(popSpan(), successSpan(path)));
  });

  it('should report 404 in tags', (done) => {
    const path = '/pathno';
    getClient().get(server.url(path))
      .on('response', () => {
        expectSpan(popSpan(), {
          name: 'get',
          kind: 'CLIENT',
          localEndpoint: {serviceName},
          remoteEndpoint: {serviceName: remoteServiceName},
          tags: {
            'http.path': path,
            'http.status_code': '404',
            error: '404'
          }
        });
        done();
      })
      .on('error', error => done(error));
  });

  it('should report 401 in tags', (done) => {
    const path = '/weather/securedTown';
    getClient().get(server.url(path))
      .on('response', () => {
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
        done();
      })
      .on('error', error => done(error));
  });

  it('should report 500 in tags', (done) => {
    const path = '/weather/bagCity';
    getClient().get(server.url(path))
      .on('response', () => {
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
        done();
      })
      .on('error', error => done(error));
  });

  it('should report when endpoint doesnt exist in tags', (done) => {
    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    getClient().get({url: badUrl, timeout: 300})
      .on('error', (error) => {
        expectSpan(popSpan(), {
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
      // since these are sequential, we should have an expected order
      expectSpan(popSpan(), successSpan(wuhan));
      expectSpan(popSpan(), successSpan(beijing));
    }));
  });
});
