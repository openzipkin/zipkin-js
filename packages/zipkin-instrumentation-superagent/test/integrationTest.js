import request from 'superagent';
import zipkinPlugin from '../src/superagentPlugin';

const {expectB3Headers, setupTestServer, setupTestTracer} = require('../../../test/testFixture');

// NOTE: axiosjs raises an error on non 2xx status instead of passing to the normal callback.
describe('SuperAgent instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();
  const tracer = setupTestTracer({localServiceName: serviceName});

  function get(urlToGet) {
    return request.get(urlToGet).use(zipkinPlugin({tracer: tracer.tracer(), remoteServiceName}));
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
    return get(server.url(path))
      .then(response => expectB3Headers(tracer.popSpan(), response.body));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return get(server.url(path))
      .then(() => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should report 404 in tags', (done) => {
    const path = '/pathno';
    get(server.url(path))
      .then((response) => {
        done(new Error(`expected status 404 response to error. status: ${response.status}`));
      })
      .catch(() => {
        tracer.expectNextSpanToEqual({
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
    get(server.url(path))
      .then((response) => {
        done(new Error(`expected status 401 response to error. status: ${response.status}`));
      })
      .catch(() => {
        tracer.expectNextSpanToEqual({
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
    get(server.url(path))
      .then((response) => {
        done(new Error(`expected status 500 response to error. status: ${response.status}`));
      })
      .catch(() => {
        tracer.expectNextSpanToEqual({
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
      });
  });

  it('should support nested get requests', () => {
    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = get(server.url(beijing));
    const getWuhanWeather = get(server.url(wuhan));

    return getBeijingWeather.then(() => getWuhanWeather.then(() => {
      // While requests are sequential, some runtimes report out-of-order for unknown reasons.
      // This defensiveness prevents CI flakes.
      const firstSpan = tracer.popSpan();
      const firstPath = firstSpan.tags['http.path'] === wuhan ? wuhan : beijing;
      const secondPath = firstPath === wuhan ? beijing : wuhan;

      tracer.expectSpan(firstSpan, successSpan(firstPath));
      tracer.expectNextSpanToEqual(successSpan(secondPath));
    }));
  });

  it('should support parallel get requests', () => {
    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = get(server.url(beijing));
    const getWuhanWeather = get(server.url(wuhan));

    return Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstSpan = tracer.popSpan();
      const firstPath = firstSpan.tags['http.path'] === wuhan ? wuhan : beijing;
      const secondPath = firstPath === wuhan ? beijing : wuhan;

      tracer.expectSpan(firstSpan, successSpan(firstPath));
      tracer.expectNextSpanToEqual(successSpan(secondPath));
    });
  });
});
