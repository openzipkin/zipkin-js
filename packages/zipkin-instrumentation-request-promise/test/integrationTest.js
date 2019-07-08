const {expect} = require('chai');
const {ExplicitContext, Tracer} = require('zipkin');
const {
  maybeMiddleware,
  newSpanRecorder,
  expectB3Headers,
  expectSpan
} = require('../../../test/testFixture');

const ZipkinRequest = require('../src/request').default;

// NOTE: request-promise throws on non 2xx status instead of using the normal callback.
describe('request-promise instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let server;
  let baseURL;

  before((done) => {
    server = maybeMiddleware().listen(0, () => {
      baseURL = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after(() => {
    if (server) server.close();
  });

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
    // NOTE: this is instantiated differently than others: you don't pass in a request function
    return new ZipkinRequest(tracer, remoteServiceName);
  }

  function url(path) {
    return `${baseURL}${path}?index=10&count=300`;
  }

  function successSpan(path) {
    return ({
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '202'
      }
    });
  }

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    return getClient().get(url(path))
      .then(response => expectB3Headers(popSpan(), JSON.parse(response)));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return getClient().get(url(path))
      .then(() => expectSpan(popSpan(), successSpan(path)));
  });

  it('should report 404 in tags', (done) => {
    const path = '/pathno';
    getClient().get(url(path))
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

  it('should report 400 in tags', (done) => {
    const path = '/weather/securedTown';
    getClient().get(url(path))
      .then((response) => {
        done(new Error(`expected status 400 response to error. status: ${response.status}`));
      })
      .catch(() => {
        expectSpan(popSpan(), {
          name: 'get',
          kind: 'CLIENT',
          localEndpoint: {serviceName},
          remoteEndpoint: {serviceName: remoteServiceName},
          tags: {
            'http.path': path,
            'http.status_code': '400',
            error: '400'
          }
        });
        done();
      });
  });

  it('should report 500 in tags', (done) => {
    const path = '/weather/bagCity';
    getClient().get(url(path))
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

  it('should report when endpoint doesnt exist in tags', function(done) { // => breaks this.timeout
    this.timeout(1000); // Wait long than request timeout

    const path = '/badHost';
    const badUrl = `http://localhost:12345${path}`;
    getClient().get({url: badUrl, timeout: 300})
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

    const getBeijingWeather = client.get(url(beijing));
    const getWuhanWeather = client.get(url(wuhan));

    return getBeijingWeather.then(() => {
      getWuhanWeather.then(() => {
        // since these are sequential, we should have an expected order
        expectSpan(popSpan(), successSpan(wuhan));
        expectSpan(popSpan(), successSpan(beijing));
      });
    });
  });

  it('should support parallel get requests', () => {
    const client = getClient();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client.get(url(beijing));
    const getWuhanWeather = client.get(url(wuhan));

    return Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstPath = spans[0].tags['http.path'] === wuhan ? beijing : wuhan;
      const secondPath = firstPath === wuhan ? beijing : wuhan;
      expectSpan(popSpan(), successSpan(firstPath));
      expectSpan(popSpan(), successSpan(secondPath));
    });
  });
});
