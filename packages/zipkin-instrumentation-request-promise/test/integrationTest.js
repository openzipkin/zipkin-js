const ZipkinRequest = require('../src/request').default;

const {expectB3Headers, setupTestServer, setupTestTracer} = require('../../../test/testFixture');

// NOTE: request-promise throws on non 2xx status instead of using the normal callback.
describe('request-promise instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();
  const tracer = setupTestTracer({localServiceName: serviceName});

  function getClient() {
    // NOTE: this is instantiated differently than others: you don't pass in a request function
    return new ZipkinRequest(tracer.tracer(), remoteServiceName);
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
      .then(response => expectB3Headers(tracer.popSpan(), JSON.parse(response)));
  });

  // TODO: move to other http tests
  it('should send "x-b3-flags" header when debug', () => {
    const path = '/weather/wuhan';
    return tracer.runInDebugTrace(() => getClient().get(server.url(path))
      .then(response => expectB3Headers(tracer.popDebugSpan(), JSON.parse(response))));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return getClient().get(server.url(path))
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

  it('should report when endpoint doesnt exist in tags', function(done) { // => breaks this.timeout
    this.timeout(1000); // Wait long than request timeout

    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    getClient().get({url: badUrl, timeout: 300})
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
            error: error.cause.toString() // NOTE: this library wraps with RequestError
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

  // TODO: not all http clients test this
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
