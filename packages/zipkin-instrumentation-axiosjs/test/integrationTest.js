const {BatchRecorder, ExplicitContext, Tracer, jsonEncoder: {JSON_V2}} = require('zipkin');
const axios = require('axios');
const {expect} = require('chai');
const wrapAxios = require('../src/index');

describe('axios instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let server;
  let baseUrl;
  let tracer;

  before((done) => {
    if (typeof window !== 'undefined' && typeof window.__karma__ !== 'undefined') {
      baseUrl = '';
      done(); // inside karma we can't start a server!
    }

    // below intentionally defers loading to express middleware so that webpack doesn't bundle it

    // eslint-disable-next-line global-require
    const middleware = require('../../../test/middleware');
    server = middleware().listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  let spans;

  beforeEach(() => {
    spans = [];
    const ctxImpl = new ExplicitContext();
    const recorder = new BatchRecorder({logger: {logSpan: (span) => {
      spans.push(JSON.parse(JSON_V2.encode(span)));
    }}});
    tracer = new Tracer({ctxImpl, recorder});
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
    getClient().get(url()).then(response => {
      expect(spans).to.have.length(1);

      const requestHeaders = response.data;
      expect(requestHeaders['x-b3-traceid']).to.equal(spans[0].traceId);
      expect(requestHeaders['x-b3-spanid']).to.equal(spans[0].id);
      expect(requestHeaders['x-b3-sampled']).to.equal('1');

      /* eslint-disable no-unused-expressions */
      expect(requestHeaders['x-b3-parentspanid']).to.not.exist;
      expect(requestHeaders['x-b3-flags']).to.not.exist;

      return done();
    }).catch(error => done(error));
  });

  it('should support get request', done => {
    getClient().get(url)
      .then(() => {
        verifyGetSpan({
          'http.path': path,
          'http.status_code': '202'
        });
        done();
      })
      .catch(error => done(error));
  });

  it('should support options request', done => {
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
    getClient()({url: `${baseUrl}${badPath}`, timeout: 100})
      .catch(error => {
        verifyGetSpan({
          'http.path': badPath,
          'http.status_code': '404',
          'error': '404'
        });
        done();
      });
  });

  it('should report 400 in tags', done => {
    const badPath = '/weather/securedTown';
    getClient()({url: `${baseUrl}${badPath}`, timeout: 100})
      .catch(error => {
        verifyGetSpan({
          'http.path': badPath,
          'http.status_code': '400',
          'error': '400'
        });
        done();
      });
  });

  it('should report 500 in tags', done => {
    const badPath = '/weather/bagCity';
    getClient()({url: `${baseUrl}${badPath}`, timeout: 100})
      .catch(error => {
        verifyGetSpan({
          'http.path': badPath,
          'http.status_code': '500',
          'error': '500'
        });
        done();
      });
  });

  it('should report when endpoint doesnt exist in tags', done => {
    getClient()({url: `http://localhost:12345${path}`, timeout: 200})
      .catch(error => {
        verifyGetSpan({
          'http.path': path,
          'error': error.toString()
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
