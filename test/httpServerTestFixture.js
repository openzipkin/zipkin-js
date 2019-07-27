const {InetAddress} = require('zipkin');
const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const fsPath = require('path');
const {setupTestTracer} = require('./testFixture');

class TestServer {
  // This doesn't eagerly reference the server URL, as it isn't available until "before all"
  constructor({app, tracer, routeBasedSpanName}) {
    this._app = app;
    this._tracer = tracer;
    this._routeBasedSpanName = routeBasedSpanName;
    this._localServiceName = tracer.tracer().localEndpoint.serviceName;
    this._ipv4 = InetAddress.getLocalAddress().ipv4();
  }

  _spanName(route) {
    if (!this._routeBasedSpanName) return 'get';
    if (route === '/weather/peking') return 'get redirected';
    if (route === '/pathno') return 'get not_found';
    return `get ${route}`.toLowerCase();
  }

  successSpan({path, city, status = 200}) {
    return ({
      name: this._spanName(path),
      kind: 'SERVER',
      localEndpoint: {serviceName: this._localServiceName, ipv4: this._ipv4},
      tags: {
        'http.path': path,
        'http.status_code': status.toString(),
        city
      }
    });
  }

  errorSpan({path, city, status}) {
    const result = {
      name: this._spanName(path),
      kind: 'SERVER',
      localEndpoint: {serviceName: this._localServiceName, ipv4: this._ipv4},
      tags: {
        'http.path': path,
        'http.status_code': status.toString(),
        error: status.toString(), // TODO: better error message especially on 500
      }
    };
    if (city) result.tags.city = city;
    return result;
  }

  baseURL() {
    return this._baseURL;
  }

  tracer() {
    return this._tracer;
  }
}

// Sets up an http server test fixture which runs basic tests.
//
// Installation should be like this:
//
// ```javascript
// const serverFixture = require('../../../test/httpServerTestFixture');
//
// serverFixture.setupAllHttpServerTests({serverFunction});
// ```
//
// If some tests fail, you can instead install only the basic tests first.
//
// ```javascript
// const serverFixture = require('../../../test/httpServerTestFixture');
//
// serverFixture.setupBasicHttpServerTests({serverFunction});
// ```
//
// ## Implementing the server function
//
// The serverFunction takes options of {tracer} and returns middleware object that serves the
// following paths in the corresponding syntax of the library in use.
//
// ```javascript
// app.get('/weather/wuhan', (req, res) => {
//   tracer.recordBinary('city', 'wuhan');
//   res.status(200).json(req.headers);
// });
// app.get('/weather/beijing', (req, res) => {
//   tracer.recordBinary('city', 'beijing');
//   res.status(200).json(req.headers);
// });
// app.get('/weather/peking', (req, res) => {
//   tracer.recordBinary('city', 'peking');
//   res.redirect('/weather/beijing');
// });
// app.get('/weather/shenzhen', (req, res) => new Promise(done => setTimeout(() => {
//   tracer.letId(req._trace_id, () => {
//     tracer.recordBinary('city', 'shenzhen');
//     done();
//   });
// }, 10)).then(() => res.send(200)));
// app.get('/weather/securedTown', (req, res) => {
//   tracer.recordBinary('city', 'securedTown');
//   res.send(401);
// });
// app.get('/weather/bagCity', () => {
//   tracer.recordBinary('city', 'bagCity');
//   throw new Error('service is dead');
// });
// ```
//
// ### Not found (404) handling
//
// Not all instrumentation hooks into unmatched paths (ex http status 404). If yours does, configure
// like so:
//
// Ex.
// ```javascript
// const testServer = serverFixture.setupBasicHttpServerTests({serverFunction});
// serverFixture.setupNotFoundTest(testServer);
// ```
//
// ### Https
//
// If your middleware supports usage via 'https', configure like so:
//
// Ex.
// ```javascript
// const testServer = serverFixture.setupBasicHttpServerTests({serverFunction});
// serverFixture.setupHttpsServerTest(testServer);
// ```
//
// ## Composition approach
//
// Approach to compose tests is from https://github.com/mochajs/mocha/wiki/Shared-Behaviours
function setupBasicHttpServerTests({serverFunction, routeBasedSpanName = false}) {
  const serviceName = 'weather-api';

  const tracer = setupTestTracer({localServiceName: serviceName});
  const app = serverFunction({tracer: tracer.tracer()});
  const testServer = new TestServer({app, tracer, routeBasedSpanName});

  let server;
  let baseURL;

  before((done) => { // eslint-disable-line no-undef
    server = app.listen(0, () => {
      baseURL = `http://127.0.0.1:${server.address().port}`;
      testServer._baseURL = baseURL;
      done();
    });
  });

  after(() => { // eslint-disable-line no-undef
    if (server) server.close();
  });

  it('should start a new trace', () => {
    const path = '/weather/wuhan';
    return fetch(`${baseURL}${path}`)
      .then(() => tracer.expectNextSpanToEqual(testServer.successSpan({path, city: 'wuhan'})));
  });

  it('http.path tag should not include query parameters', () => {
    const path = '/weather/wuhan';
    return fetch(`${baseURL}${path}?index=10&count=300`)
      .then(() => expect(tracer.popSpan().tags['http.path']).to.equal(path));
  });

  // Until there is a CLS hooked implementation here, we need to be explicit with trace IDs.
  // See https://github.com/openzipkin/zipkin-js/issues/88
  it('should add _trace_id to request for explicit instrumentation', () => {
    const path = '/weather/shenzhen';
    return fetch(`${baseURL}${path}`)
      .then(() => tracer.expectNextSpanToEqual(testServer.successSpan({path, city: 'shenzhen'})));
  });

  it('should continue a trace from the client', () => {
    const path = '/weather/wuhan';
    return fetch(`${baseURL}${path}`, {
      method: 'get',
      headers: {
        'X-B3-TraceId': '863ac35c9f6413ad',
        'X-B3-SpanId': '48485a3953bb6124',
        'X-B3-Flags': '1'
      }
    }).then(() => {
      const baseSpan = testServer.successSpan({path, city: 'wuhan'});
      const span = tracer.expectNextSpanToEqual({...baseSpan, ...{debug: true, shared: true}});
      expect(span.traceId).to.equal('863ac35c9f6413ad');
      expect(span.id).to.equal('48485a3953bb6124');
    });
  });

  it('should accept a 128bit X-B3-TraceId', () => {
    const traceId = '863ac35c9f6413ad48485a3953bb6124';
    const path = '/weather/wuhan';
    return fetch(`${baseURL}${path}`, {
      method: 'get',
      headers: {
        'X-B3-TraceId': traceId,
        'X-B3-SpanId': '48485a3953bb6124',
        'X-B3-Sampled': '1'
      }
    }).then(() => expect(tracer.popSpan().traceId).to.equal(traceId));
  });

  it('should report 302 in tags, but not as error', () => {
    const path = '/weather/peking';
    const expectedSpan = testServer.successSpan({path, city: 'peking', status: 302});
    return fetch(`${baseURL}${path}`, {redirect: 'manual'})
      .then(() => tracer.expectNextSpanToEqual(expectedSpan));
  });

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    const expectedSpan = testServer.errorSpan({path, city: 'securedTown', status: 401});
    return fetch(`${baseURL}${path}`).then(() => tracer.expectNextSpanToEqual(expectedSpan));
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    const expectedSpan = testServer.errorSpan({path, city: 'bagCity', status: 500});
    return fetch(`${baseURL}${path}`).then(() => tracer.expectNextSpanToEqual(expectedSpan));
  });

  return testServer;
}

function setupNotFoundTest(testServer) {
  it('should report 404 in tags', () => {
    const path = '/pathno';
    const expectedSpan = testServer.errorSpan({path, status: 404});
    return fetch(`${testServer._baseURL}${path}`)
      .then(() => testServer.tracer().expectNextSpanToEqual(expectedSpan));
  });
}

function setupHttpsServerTest(testServer) {
  const tracer = testServer.tracer();
  let tlsServer;
  let baseTlsURL;

  before((done) => { // eslint-disable-line no-undef
    const tlsOptions = {
      rejectUnauthorized: false,
      key: fs.readFileSync(fsPath.join(__dirname, 'keys', 'server.key'), 'utf8'),
      cert: fs.readFileSync(fsPath.join(__dirname, 'keys', 'server.crt'), 'utf8'),
    };

    tlsServer = https.createServer(tlsOptions, testServer._app).listen(0, () => {
      baseTlsURL = `https://localhost:${tlsServer.address().port}`;
      done();
    });
  });

  after(() => { // eslint-disable-line no-undef
    if (tlsServer) tlsServer.close();
  });

  it('should work with https', () => {
    const path = '/weather/wuhan';
    return fetch(`${baseTlsURL}${path}`, {
      agent: new https.Agent({rejectUnauthorized: false})
    }).then(() => tracer.expectNextSpanToEqual(testServer.successSpan({path, city: 'wuhan'})));
  });
}

function setupAllHttpServerTests(options) {
  const testServer = setupBasicHttpServerTests(options);
  setupHttpsServerTest(testServer);
  setupNotFoundTest(testServer);
  return testServer;
}

module.exports = {
  setupAllHttpServerTests,
  setupBasicHttpServerTests,
  setupNotFoundTest,
  setupHttpsServerTest
};