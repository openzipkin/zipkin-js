const axios = require('axios');
const wrapAxios = require('../src/index');

const {expectB3Headers, setupTestServer, setupTestTracer} = require('../../../test/testFixture');

// NOTE: axiosjs raises an error on non 2xx status instead of passing to the normal callback.
describe('axios instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();
  const tracer = setupTestTracer({localServiceName: serviceName});

  function getClient() {
    const instance = axios.create({
      timeout: 300 // this avoids flakes in CI
    });

    return wrapAxios(instance, {tracer: tracer.tracer(), remoteServiceName});
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
      .then(response => expectB3Headers(tracer.popSpan(), response.data));
  });

  it('should not interfere with errors that precede a call', (done) => {
    // Here we are passing a function instead of the value of it. This ensures our error callback
    // doesn't make assumptions about a span in progress: there won't be if there was a config error
    getClient()(server.url)
      .then((response) => {
        done(new Error(`expected an invalid url parameter to error. status: ${response.status}`));
      })
      .catch((error) => {
        const {message} = error;
        const expected = ['must be of type string', 'must be a string']; // messages can vary in CI
        if (message.indexOf(expected[0]) !== -1 || message.indexOf(expected[1]) !== -1) {
          done();
        } else {
          done(new Error(`expected error message to match [${expected.toString()}]: ${message}`));
        }
      });
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return getClient().get(server.url(path))
      .then(() => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should support options request', () => {
    const path = '/weather/wuhan';
    return getClient()({url: server.url(path)})
      .then(() => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should report 404 in tags', (done) => {
    const path = '/pathno';
    getClient().get(server.url(path))
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
    getClient().get(server.url(path))
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
    getClient().get(server.url(path))
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
    getClient().get(badUrl)
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
    const client = getClient();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client.get(server.url(beijing));
    const getWuhanWeather = client.get(server.url(wuhan));

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
    const client = getClient();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client.get(server.url(beijing));
    const getWuhanWeather = client.get(server.url(wuhan));

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
