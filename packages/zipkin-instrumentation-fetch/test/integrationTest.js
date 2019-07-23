const {expect} = require('chai');
const {ExplicitContext, Tracer} = require('zipkin');
const {
  expectB3Headers,
  expectSpan,
  newSpanRecorder,
  setupTestServer
} = require('../../../test/testFixture');

// defer lookup of node fetch until we know if we are node
const wrapFetch = require('../src/wrapFetch');

describe('fetch instrumentation - integration test', () => {
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

  function wrappedFetch() {
    let fetch;
    if (global.server) { // defer loading node-fetch
      fetch = require('node-fetch'); // eslint-disable-line global-require
    } else {
      fetch = window.fetch; // eslint-disable-line
    }
    return wrapFetch(fetch, {tracer, remoteServiceName});
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

  it('should not interfere with errors that precede a call', (done) => {
    // Here we are passing a function instead of the value of it. This ensures our error callback
    // doesn't make assumptions about a span in progress: there won't be if there was a config error
    wrappedFetch()(url)
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
    return wrappedFetch()(url(path))
      .then(response => response.json()) // json() returns a promise
      .then(json => expectB3Headers(popSpan(), json));
  });


  it('should support get request', () => {
    const path = '/weather/wuhan';
    return wrappedFetch()(url(path))
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should support options request', () => {
    const path = '/weather/wuhan';
    return wrappedFetch()({url: url(path), method: 'GET'})
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should report 404 in tags', () => {
    const path = '/pathno';
    return wrappedFetch()(url(path))
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

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    return wrappedFetch()(url(path))
      .then(() => expectSpan(popSpan(), {
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
    return wrappedFetch()(url(path))
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

  it('should report when endpoint doesnt exist in tags', (done) => {
    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    wrappedFetch()(badUrl)
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
    const client = wrappedFetch();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client(url(beijing));
    const getWuhanWeather = client(url(wuhan));

    return getBeijingWeather.then(() => {
      getWuhanWeather.then(() => {
        // since these are sequential, we should have an expected order
        expectSpan(popSpan(), successSpan(wuhan));
        expectSpan(popSpan(), successSpan(beijing));
      });
    });
  });

  it('should support parallel get requests', () => {
    const client = wrappedFetch();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client(url(beijing));
    const getWuhanWeather = client(url(wuhan));

    return Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstPath = spans[0].tags['http.path'] === wuhan ? beijing : wuhan;
      const secondPath = firstPath === wuhan ? beijing : wuhan;
      expectSpan(popSpan(), successSpan(firstPath));
      expectSpan(popSpan(), successSpan(secondPath));
    });
  });
});
