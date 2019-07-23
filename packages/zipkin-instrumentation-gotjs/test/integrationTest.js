const {expect} = require('chai');
const {ExplicitContext, Tracer} = require('zipkin');

const got = require('got');
const {
  expectB3Headers,
  expectSpan,
  newSpanRecorder,
  setupTestServer,
} = require('../../../test/testFixture');
const wrapGot = require('../src/wrapGot');

describe('got instrumentation - integration test', () => {
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

  function wrappedGot() {
    return wrapGot(got, {tracer, remoteServiceName});
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
    wrappedGot()(url)
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
    return wrappedGot()(url(path))
      .then(response => expectB3Headers(popSpan(), JSON.parse(response.body)));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return wrappedGot()(url(path))
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should support options request', () => {
    const path = '/weather/wuhan';
    return wrappedGot()({url: url(path), method: 'GET'})
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should report 404 in tags', (done) => {
    const path = '/pathno';
    wrappedGot()(url(path))
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
    wrappedGot()(url(path))
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
    wrappedGot()(url(path), {retry: 0})
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
    wrappedGot()(badUrl, {retry: 0})
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
    const client = wrappedGot();

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
    const client = wrappedGot();

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
