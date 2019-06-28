const {ExplicitContext, Tracer} = require('zipkin');
const axios = require('axios');
const {expect} = require('chai');
const wrapAxios = require('../src/index');
const {maybeMiddleware, newSpanRecorder} = require('../../../test/testFixture');

describe('axios instrumentation - integration test', () => {
  const errorTimeout = 200; // this avoids flakes in CI
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let server;
  let baseUrl = ''; // default to relative path, for browser-based tests
  let tracer;

  before((done) => {
    const middleware = maybeMiddleware();
    if (middleware !== null) {
      server = middleware.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    } else { // Inside a browser
      done();
    }
  });

  after(() => {
    if (server) server.close();
  });

  let spans;

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({ctxImpl: new ExplicitContext(), recorder: newSpanRecorder(spans)});
  });

  const getClient = () => wrapAxios(axios, {tracer, serviceName, remoteServiceName});

  const path = '/weather/wuhan';
  const url = () => `${baseUrl}${path}?index=10&count=300`; // defers access to baseUrl

  function verifyGetSpan(tags) {
    const span = spans.pop();

    expect(span.traceId)
      .to.equal(span.id).and
      .to.have.lengthOf(16);

    expect(span).to.deep.equal({
      // Just assert that the volatile fields exist
      traceId: span.traceId,
      id: span.id,
      timestamp: span.timestamp,
      duration: span.duration,

      // Check the value of fields we expect instrumentation to control
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags
    });
  }

  it('should add headers to requests', done => {
    getClient().get(url())
      .then(response => {
        expect(spans).to.have.length(1);

        const requestHeaders = response.data;
        expect(requestHeaders['x-b3-traceid']).to.equal(spans[0].traceId);
        expect(requestHeaders['x-b3-spanid']).to.equal(spans[0].id);
        expect(requestHeaders['x-b3-sampled']).to.equal('1');

        /* eslint-disable no-unused-expressions */
        expect(requestHeaders['x-b3-parentspanid']).to.not.exist;
        expect(requestHeaders['x-b3-flags']).to.not.exist;

        return done();
      })
      .catch(error => done(error));
  });

  it('should not interfere with errors that precede a call', done => {
    // Here we are passing a function instead of the value of it. This ensures our error callback
    // doesn't make assumptions about a span in progress: there won't be if there was a config error
    getClient()(url)
      .then(response => {
        done(new Error(`expected an invalid url parameter to error. status: ${response.status}`))
      })
      .catch(error => {
        const message = error.message;
        const expected = [
          'The "url" argument must be of type string', // node
          'Parameter \'url\' must be a string' // browser
        ];
        if (message.indexOf(expected[0]) !== -1 || message.indexOf(expected[1]) !== -1) {
          done();
        } else {
          done(new Error(`expected error message to match [${expected.toString()}]: ${message}`));
        }
      });
  });

  it('should support get request', done => {
    getClient().get(url())
      .then(() => {
        verifyGetSpan({
          'http.path': path,
          'http.status_code': '202'
        });
        done();
      })
      .catch(error => done(error));
  });

  it('should support config request', done => {
    getClient()({url: url()})
      .then(() => {
        verifyGetSpan({
          'http.path': path,
          'http.status_code': '202'
        });
        done();
      })
      .catch(error => done(error));
  });

  it('should report 404 in tags', done => {
    const badPath = '/pathno';
    getClient()({url: `${baseUrl}${badPath}`, timeout: errorTimeout})
      .then(response => {
        done(new Error(`expected status 404 response to error. status: ${response.status}`))
      })
      .catch(() => {
        verifyGetSpan({
          'http.path': badPath,
          'http.status_code': '404',
          error: '404'
        });
        done();
      });
  });

  it('should report 400 in tags', done => {
    const badPath = '/weather/securedTown';
    getClient()({url: `${baseUrl}${badPath}`, timeout: errorTimeout})
      .then(response => {
        done(new Error(`expected status 400 response to error. status: ${response.status}`))
      })
      .catch(() => {
        verifyGetSpan({
          'http.path': badPath,
          'http.status_code': '400',
          error: '400'
        });
        done();
      });
  });

  it('should report 500 in tags', done => {
    const badPath = '/weather/bagCity';
    getClient()({url: `${baseUrl}${badPath}`, timeout: errorTimeout})
      .then(response => {
        done(new Error(`expected status 500 response to error. status: ${response.status}`))
      })
      .catch(() => {
        verifyGetSpan({
          'http.path': badPath,
          'http.status_code': '500',
          error: '500'
        });
        done();
      });
  });

  it('should report when endpoint doesnt exist in tags', done => {
    getClient()({url: `http://localhost:12345${path}`, timeout: errorTimeout})
      .then(response => {
        done(new Error(`expected an invalid host to error. status: ${response.status}`))
      })
      .catch(error => {
        verifyGetSpan({
          'http.path': path,
          error: error.toString()
        });
        done();
      });
  });

  it('should support nested get requests', done => {
    const client = getClient();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client.get(`${baseUrl}${beijing}`);
    const getWuhanWeather = client.get(`${baseUrl}${wuhan}`);

    getBeijingWeather.then(() => {
      getWuhanWeather.then(() => {
        // since these are sequential, we should have an expected order
        verifyGetSpan({
          'http.path': wuhan,
          'http.status_code': '202'
        });
        verifyGetSpan({
          'http.path': beijing,
          'http.status_code': '202'
        });
        done();
      });
    }).catch(error => done(error));
  });

  it('should support parallel get requests', done => {
    const client = getClient();

    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = client.get(`${baseUrl}${beijing}`);
    const getWuhanWeather = client.get(`${baseUrl}${wuhan}`);

    Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstPath = spans[0].tags['http.path'] === wuhan ? beijing : wuhan;
      verifyGetSpan({
        'http.path': firstPath,
        'http.status_code': '202'
      });
      verifyGetSpan({
        'http.path': firstPath === wuhan ? beijing : wuhan,
        'http.status_code': '202'
      });
      done();
    }).catch(error => done(error));
  });
});
