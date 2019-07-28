const {InetAddress} = require('zipkin');
const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');
const fsPath = require('path');
const {setupTestTracer} = require('./testFixture');

class TestServer {
  // This doesn't eagerly reference the server URL, as it isn't available until "before all"
  constructor({
    app,
    testTracer,
    routeBasedSpanName,
    addTag
  }) {
    this._app = app;
    this._testTracer = testTracer;
    this._routeBasedSpanName = routeBasedSpanName;
    this._addTag = addTag;
    this._localServiceName = testTracer.tracer().localEndpoint.serviceName;
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
    return this._testTracer;
  }
}

// Sets up an http server test fixture which runs basic tests.
//
// Installation should be like this:
//
// ```javascript
// const serverFixture = require('../../../test/httpServerTestFixture');
//
// serverFixture.setupAllHttpServerTests({middlewareFunction});
// ```
//
// If some tests fail, you can instead install only the basic tests first.
//
// ```javascript
// const serverFixture = require('../../../test/httpServerTestFixture');
//
// serverFixture.setupBasicHttpServerTests({middlewareFunction});
// ```
//
// ## Implementing the middleware function
//
// The middlewareFunction takes options of {tracer, routes} and returns middleware object that
// serves routes corresponding to the inputs.
//
// Ex. for express
// ```javascript
// function middlewareFunction({tracer, routes}) {
//   const app = express();
//   app.use(middleware({tracer}));
//   routes.forEach((route) => {
//     app.get(route.path, (req, res) => route.handle(req, ({redirect, body, code}) => {
//       if (redirect) {
//         return res.redirect(redirect);
//       } else if (body) {
//         return res.json(body);
//       } else if (code) {
//         return res.send(code);
//       }
//       return res.send();
//     }));
//   });
//   return app;
// }
// ```
//
// ### Not found (404) handling
//
// Not all instrumentation hooks into unmatched paths (ex http status 404). If yours does, configure
// like so:
//
// Ex.
// ```javascript
// const testServer = serverFixture.setupBasicHttpServerTests({middlewareFunction});
// serverFixture.setupNotFoundTest(testServer);
// ```
//
// ### Https
//
// If your middleware supports usage via 'https', configure like so:
//
// Ex.
// ```javascript
// const testServer = serverFixture.setupBasicHttpServerTests({middlewareFunction});
// serverFixture.setupHttpsServerTest(testServer);
// ```
//
// ## Composition approach
//
// Approach to compose tests is from https://github.com/mochajs/mocha/wiki/Shared-Behaviours
function setupBasicHttpServerTests({
  middlewareFunction,
  routeBasedSpanName = false,
  serverFunction = (app, onListen) => {
    const server = app.listen(0, () => onListen(server.address().port));
    return server;
  },
  addTag = (tracer, request, key, value) => tracer.recordBinary(key, value)
}) {
  const serviceName = 'weather-api';

  const testTracer = setupTestTracer({localServiceName: serviceName});
  const tracer = testTracer.tracer();
  const routes = [];

  const wuhan = {
    city: 'wuhan',
    path: '/weather/wuhan',
    handle: (request, responseCallback) => {
      addTag(tracer, request, 'city', 'wuhan');
      return responseCallback({body: request.headers});
    }
  };
  routes.push(wuhan);

  const beijing = {
    city: 'beijing',
    path: '/weather/beijing',
    handle: (request, responseCallback) => {
      addTag(tracer, request, 'city', 'beijing');
      return responseCallback({body: request.headers});
    }
  };
  routes.push(beijing);

  const peking = {
    city: 'peking',
    path: '/weather/peking',
    handle: (request, responseCallback) => {
      addTag(tracer, request, 'city', 'peking');
      return responseCallback({redirect: beijing.path});
    }
  };
  routes.push(peking);

  const shenzhen = {
    city: 'shenzhen',
    path: '/weather/shenzhen',
    handle: (request, responseCallback) => new Promise(done => setTimeout(() => {
      tracer.letId(request._trace_id, () => {
        addTag(tracer, request, 'city', 'shenzhen');
        done();
      });
    }, 10)).then(() => responseCallback({}))
  };
  routes.push(shenzhen);

  const siping = {
    city: 'siping',
    path: '/weather/siping',
    handle: (request, responseCallback) => new Promise(done => setTimeout(() => {
      responseCallback({body: done()});
    }, 4))
  };
  routes.push(siping);

  const securedTown = {
    city: 'securedTown',
    path: '/weather/securedTown',
    handle: (request, responseCallback) => {
      addTag(tracer, request, 'city', 'securedTown');
      return responseCallback({code: 401});
    }
  };
  routes.push(securedTown);

  const bagCity = {
    city: 'bagCity',
    path: '/weather/bagCity',
    handle: (request) => {
      addTag(tracer, request, 'city', 'bagCity');
      throw new Error('service is dead');
    }
  };
  routes.push(bagCity);

  const app = middlewareFunction({tracer, routes});
  const testServer = new TestServer({
    app,
    testTracer,
    routeBasedSpanName,
    addTag
  });

  let server;
  let baseURL;

  before((done) => { // eslint-disable-line no-undef
    server = serverFunction(app, (listenPort) => {
      baseURL = `http://127.0.0.1:${listenPort}`;
      testServer._baseURL = baseURL;
      done();
    });
  });

  after(() => { // eslint-disable-line no-undef
    if (server) server.close();
  });

  it('should start a new trace', () => {
    const {path, city} = wuhan;
    fetch(`${baseURL}${path}`)
      .then(() => testTracer.expectNextSpanToEqual(testServer.successSpan({path, city})));
  });

  it('should record a reasonably accurate span duration', () => {
    const {path} = siping;
    return fetch(`${baseURL}${path}`).then(() => {
      // 50 years ago, Changchun, the capital of Jilin province, had only one railway to south.
      // Siping (四平) is the city at fourth stop station, hence stopping 4ms.
      expect(testTracer.popSpan().duration / 1000.0).to.be.greaterThan(4);
    });
  });

  it('http.path tag should not include query parameters', () => {
    const {path} = wuhan;
    return fetch(`${baseURL}${path}?index=10&count=300`)
      .then(() => expect(testTracer.popSpan().tags['http.path']).to.equal(path));
  });

  // Until there is a CLS hooked implementation here, we need to be explicit with trace IDs.
  // See https://github.com/openzipkin/zipkin-js/issues/88
  it('should add _trace_id to request for explicit instrumentation', () => {
    const {path, city} = shenzhen;
    return fetch(`${baseURL}${path}`)
      .then(() => testTracer.expectNextSpanToEqual(testServer.successSpan({path, city})));
  });

  it('should continue a trace from the client', () => {
    const {path, city} = wuhan;
    return fetch(`${baseURL}${path}`, {
      method: 'get',
      headers: {
        'X-B3-TraceId': '863ac35c9f6413ad',
        'X-B3-SpanId': '48485a3953bb6124',
        'X-B3-Flags': '1'
      }
    }).then(() => {
      const baseSpan = testServer.successSpan({path, city});
      const span = testTracer.expectNextSpanToEqual({...baseSpan, ...{debug: true, shared: true}});
      expect(span.traceId).to.equal('863ac35c9f6413ad');
      expect(span.id).to.equal('48485a3953bb6124');
    });
  });

  it('should accept a 128bit X-B3-TraceId', () => {
    const traceId = '863ac35c9f6413ad48485a3953bb6124';
    const {path} = wuhan;
    return fetch(`${baseURL}${path}`, {
      method: 'get',
      headers: {
        'X-B3-TraceId': traceId,
        'X-B3-SpanId': '48485a3953bb6124',
        'X-B3-Sampled': '1'
      }
    }).then(() => expect(testTracer.popSpan().traceId).to.equal(traceId));
  });

  it('should report 302 in tags, but not as error', () => {
    const {path, city} = peking;
    const expectedSpan = testServer.successSpan({path, city, status: 302});
    return fetch(`${baseURL}${path}`, {redirect: 'manual'})
      .then(() => testTracer.expectNextSpanToEqual(expectedSpan));
  });

  it('should report 401 in tags', () => {
    const {path, city} = securedTown;
    const expectedSpan = testServer.errorSpan({path, city, status: 401});
    return fetch(`${baseURL}${path}`).then(() => testTracer.expectNextSpanToEqual(expectedSpan));
  });

  it('should report 500 in tags', () => {
    const {path, city} = bagCity;
    const expectedSpan = testServer.errorSpan({path, city, status: 500});
    return fetch(`${baseURL}${path}`).then(() => testTracer.expectNextSpanToEqual(expectedSpan));
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

function setupHttpsServerTest({
  testServer,
  httpsServerFunction = (options, app, onListen) => {
    const httpsServer = https.createServer(options, app)
      .listen(0, () => onListen(httpsServer.address().port));
    return httpsServer;
  }
}) {
  const testTracer = testServer.tracer();
  let httpsServer;
  let baseHttpsURL;

  before((done) => { // eslint-disable-line no-undef
    const options = {
      rejectUnauthorized: false,
      key: fs.readFileSync(fsPath.join(__dirname, 'keys', 'server.key'), 'utf8'),
      cert: fs.readFileSync(fsPath.join(__dirname, 'keys', 'server.crt'), 'utf8'),
    };
    httpsServer = httpsServerFunction(options, testServer._app, (listenPort) => {
      baseHttpsURL = `https://localhost:${listenPort}`;
      done();
    });
  });

  after(() => { // eslint-disable-line no-undef
    if (httpsServer) httpsServer.close();
  });

  it('should work with https', () => {
    const path = '/weather/wuhan';
    return fetch(`${baseHttpsURL}${path}`, {
      agent: new https.Agent({rejectUnauthorized: false})
    }).then(() => testTracer.expectNextSpanToEqual(testServer.successSpan({path, city: 'wuhan'})));
  });
}

function setupAllHttpServerTests(options) {
  const testServer = setupBasicHttpServerTests(options);
  setupHttpsServerTest({...{testServer}, ...options});
  setupNotFoundTest(testServer);
  return testServer;
}

module.exports = {
  setupAllHttpServerTests,
  setupBasicHttpServerTests,
  setupNotFoundTest,
  setupHttpsServerTest
};
