// defer lookup of node fetch until we know if we are node
const wrapFetch = require('../src/wrapFetch');

const {
  expectB3Headers,
  inBrowser,
  setupTestServer,
  setupTestTracer
} = require('../../../test/testFixture');

describe('fetch instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();

  const tracer = setupTestTracer({localServiceName: serviceName});

  function wrappedFetch() {
    let fetch;
    if (inBrowser()) {
      fetch = window.fetch; // eslint-disable-line
    } else { // defer loading node-fetch
      fetch = require('node-fetch'); // eslint-disable-line global-require
    }
    return wrapFetch(fetch, {tracer: tracer.tracer(), remoteServiceName});
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

  it('should not interfere with errors that precede a call', (done) => {
    // Here we are passing a function instead of the value of it. This ensures our error callback
    // doesn't make assumptions about a span in progress: there won't be if there was a config error
    wrappedFetch()(server.url)
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

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    return wrappedFetch()(server.url(path))
      .then(response => response.json()) // json() returns a promise
      .then(json => expectB3Headers(tracer.popSpan(), json));
  });


  it('should support get request', () => {
    const path = '/weather/wuhan';
    return wrappedFetch()(server.url(path))
      .then(() => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should support options request', () => {
    const path = '/weather/wuhan';
    return wrappedFetch()({url: server.url(path), method: 'GET'})
      .then(() => tracer.expectNextSpanToEqual(successSpan(path)));
  });

  it('should report 404 in tags', () => {
    const path = '/pathno';
    return wrappedFetch()(server.url(path))
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
    return wrappedFetch()(server.url(path))
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
    return wrappedFetch()(server.url(path))
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

  it('should report when endpoint doesnt exist in tags', (done) => {
    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    wrappedFetch()(badUrl)
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
    const client = wrappedFetch();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client(server.url(beijing));
    const getWuhanWeather = client(server.url(wuhan));

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
    const client = wrappedFetch();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client(server.url(beijing));
    const getWuhanWeather = client(server.url(wuhan));

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
