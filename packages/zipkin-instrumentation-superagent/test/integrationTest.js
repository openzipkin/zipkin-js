import request from 'superagent';

import zipkinPlugin from '../src/superagentPlugin';

const {expect} = require('chai');
const {ExplicitContext, Tracer} = require('zipkin');
const {
  expectB3Headers,
  expectSpan,
  newSpanRecorder,
  setupTestServer
} = require('../../../test/testFixture');

// NOTE: axiosjs raises an error on non 2xx status instead of passing to the normal callback.
describe('SuperAgent instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  setupTestServer();

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

  function get(urlToGet) {
    return request.get(urlToGet).use(zipkinPlugin({tracer, remoteServiceName}));
  }

  function url(path) {
    return `${global.baseURL}${path}?index=10&count=300`;
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
    return get(url(path))
      .then(response => expectB3Headers(popSpan(), response.body));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return get(url(path))
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should report 404 in tags', (done) => {
    const path = '/pathno';
    get(url(path))
      .then((response) => {
        done(new Error(`expected status 404 response to error. status: ${response.status}`));
      })
      .catch(() => {
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
      });
  });

  it('should report 401 in tags', (done) => {
    const path = '/weather/securedTown';
    get(url(path))
      .then((response) => {
        done(new Error(`expected status 401 response to error. status: ${response.status}`));
      })
      .catch(() => {
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
      });
  });

  it('should report 500 in tags', (done) => {
    const path = '/weather/bagCity';
    get(url(path))
      .then((response) => {
        done(new Error(`expected status 500 response to error. status: ${response.status}`));
      })
      .catch(() => {
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
      });
  });

  it('should report when endpoint doesnt exist in tags', (done) => {
    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    get(badUrl)
      .then((response) => {
        done(new Error(`expected an invalid host to error. status: ${response.status}`));
      })
      .catch((error) => {
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
      });
  });

  it('should support nested get requests', () => {
    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = get(url(beijing));
    const getWuhanWeather = get(url(wuhan));

    return getBeijingWeather.then(() => {
      getWuhanWeather.then(() => {
        // since these are sequential, we should have an expected order
        expectSpan(popSpan(), successSpan(wuhan));
        expectSpan(popSpan(), successSpan(beijing));
      });
    });
  });

  it('should support parallel get requests', () => {
    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = get(url(beijing));
    const getWuhanWeather = get(url(wuhan));

    return Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstPath = spans[0].tags['http.path'] === wuhan ? beijing : wuhan;
      const secondPath = firstPath === wuhan ? beijing : wuhan;
      expectSpan(popSpan(), successSpan(firstPath));
      expectSpan(popSpan(), successSpan(secondPath));
    });
  });
});
