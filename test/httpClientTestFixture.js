const {expectB3Headers, setupTestServer, setupTestTracer} = require('./testFixture');

class TestClient {
  // This doesn't eagerly reference the server URL, as it isn't available until "before all"
  constructor({
    tracer,
    remoteServiceName,
    clientFunction,
  }) {
    this._server = setupTestServer();
    this._tracer = tracer;
    this._localServiceName = tracer.tracer().localEndpoint.serviceName;
    this._remoteServiceName = remoteServiceName;
    this._client = clientFunction({tracer: tracer.tracer(), remoteServiceName});
  }

  getJson(path) {
    return this._client.getJson(this._server.url(path));
  }

  get({url, path}) {
    return this._client.get(url || this._server.url(path));
  }

  getOptions(path) {
    return this._client.getOptions(this._server.url(path));
  }

  successSpan({path, code = 200}) {
    return ({
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName: this._localServiceName},
      remoteEndpoint: {serviceName: this._remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': code.toString()
      }
    });
  }

  tracer() {
    return this._tracer;
  }
}

// Sets up an http client test fixture which runs basic tests.
//
// Installation should be like this:
//
// ```javascript
// const clientFixture = require('../../../test/httpClientTestFixture');
//
// clientFixture.setupAllHttpClientTests({clientFunction});
// ```
//
// If some tests fail, you can instead install only the basic tests first.
//
// ```javascript
// clientFixture.setupBasicHttpClientTests({clientFunction});
// ```
//
// ## Implementing the client function
//
// The clientFunction takes options of {tracer, remoteServiceName} and returns an object
// that implements the following functions:
//
// * get(url) - returns a promise of an http response
// * getJson(url) - returns a promise of an object representing json
//
// *Note* Ensure `get(url)` neither follows redirects nor retries on error
//
// ### Redirects (302)
//
// The ability to disable automatic redirects should be a common feature, but notably cujojs has no
// option to disable this. If you can disable redirect handling, but cannot run all tests, add in
// the redirect test in like so:
//
// ```javascript
// const testClient = clientFixture.setupBasicHttpClientTests({clientFunction});
// clientFixture.setupRedirectTest(testClient);
// ```
//
// ### Options requests (ex. client({url})
//
// If your client supports options requests, implement `getOptions(url)` and use all tests or add
// options tests explicitly via `setupOptionsArgumentTest`
//
// Ex.
// ```javascript
// function clientFunction({tracer, remoteServiceName}) {
// -- snip--
//   return ({
//     get(url) {
//       return wrapped(url);
//     },
//     getOptions(url) {
//       return wrapped({url}); // the only object parameter used is url
//     },
//     getJson(url) {
//       return wrapped(url).then(response => response.data);
//     }
//  });
// }
//
// const testClient = clientFixture.setupBasicHttpClientTests({clientFunction});
// clientFixture.setupOptionsArgumentTest(testClient);
// ```
//
// ## Composition approach
//
// Approach to compose tests is from https://github.com/mochajs/mocha/wiki/Shared-Behaviours
function setupBasicHttpClientTests({clientFunction, requestScoped = false}) {
  const localServiceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const tracer = setupTestTracer({localServiceName});
  const testClient = new TestClient({tracer, remoteServiceName, clientFunction});

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    return testClient.getJson(path)
      .then(json => expectB3Headers(tracer.popSpan(), json));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return testClient.get({path})
      .then(() => tracer.expectNextSpanToEqual(testClient.successSpan({path})));
  });

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    return testClient.get({path})
      .then(() => tracer.expectNextSpanToEqual({
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName: localServiceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'http.path': path,
          'http.status_code': '401',
          error: '401'
        }
      }));
  });

  it('should report 404 in tags', () => {
    const path = '/pathno';
    return testClient.get({path})
      .then(() => tracer.expectNextSpanToEqual({
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName: localServiceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'http.path': path,
          'http.status_code': '404',
          error: '404'
        }
      }));
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    return testClient.get({path})
      .then(() => tracer.expectNextSpanToEqual({
        name: 'get',
        kind: 'CLIENT',
        localEndpoint: {serviceName: localServiceName},
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
    testClient.get({url: `http://localhost:12345${path}`})
      .then((response) => {
        done(new Error(`expected an invalid host to error. status: ${response.status}`));
      })
      .catch((err) => {
        // In CujoJS, response ends up in the catch block. Add debt here until we figure out if this
        // is common or not.
        const error = err.error ? err.error : err;
        try {
          tracer.expectNextSpanToEqual({
            name: 'get',
            kind: 'CLIENT',
            localEndpoint: {serviceName: localServiceName},
            remoteEndpoint: {serviceName: remoteServiceName},
            tags: {
              'http.path': path,
              error: error.toString()
            }
          });
          done();
        } catch (assertionError) {
          done(assertionError);
        }
      });
  });

  it('should support nested get requests', () => {
    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = testClient.get({path: beijing});
    const getWuhanWeather = testClient.get({path: wuhan});

    return getBeijingWeather.then(() => getWuhanWeather.then(() => {
      // While requests are sequential, some runtimes report out-of-order for unknown reasons.
      // This defensiveness prevents CI flakes.
      const firstSpan = tracer.popSpan();
      const firstPath = firstSpan.tags['http.path'] === wuhan ? wuhan : beijing;
      const secondPath = firstPath === wuhan ? beijing : wuhan;

      tracer.expectSpan(firstSpan, testClient.successSpan({path: firstPath}));
      tracer.expectNextSpanToEqual(testClient.successSpan({path: secondPath}));
    }));
  });

  it('should support parallel get requests', () => {
    const beijing = '/weather/beijing';
    const wuhan = '/weather/wuhan';

    const getBeijingWeather = testClient.get({path: beijing});
    const getWuhanWeather = testClient.get({path: wuhan});

    return Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstSpan = tracer.popSpan();
      const firstPath = firstSpan.tags['http.path'] === wuhan ? wuhan : beijing;
      const secondPath = firstPath === wuhan ? beijing : wuhan;

      tracer.expectSpan(firstSpan, testClient.successSpan({path: firstPath}));
      tracer.expectNextSpanToEqual(testClient.successSpan({path: secondPath}));
    });
  });

  if (!requestScoped) {
    it('should not interfere with errors that precede a call', (done) => {
      // Since we pass a function of a url instead of the value of it, we expect the client to throw
      // an error. By checking the type of the error we can tell that we didn't mask it through an
      // instrumentation bug (ex assumptions about a span in progress).
      const verifyError = (error) => {
        const {message} = error;
        const expected = ['must be of type string', 'must be a string']; // messages can vary in CI
        if (message.indexOf(expected[0]) !== -1 || message.indexOf(expected[1]) !== -1) {
          done();
        } else {
          done(new Error(`expected error message to match [${expected.toString()}]: ${message}`));
        }
      };

      // Sometimes middleware eagerly references the URL, guard on that.
      let httpCall;
      try {
        httpCall = testClient.get({url: () => '/'});
      } catch (error) {
        verifyError(error);
      }

      // if we got here, the error is lazy, let's ensure it occurs!
      if (httpCall) {
        httpCall.then((response) => {
          done(new Error(`expected an invalid url parameter to error. status: ${response.status}`));
        }).catch(verifyError);
      }
    });
  }

  return testClient;
}

// Almost all clients can disable redirect handling. Sadly, the abandoned CujoJS cannot.
function setupRedirectTest(testClient) {
  it('should report 302 in tags, but not as error', () => {
    const path = '/weather/peking';
    const expected = testClient.successSpan({path, code: 302});
    return testClient.get({path})
      .then(() => testClient.tracer().expectNextSpanToEqual(expected));
  });
}

function setupOptionsArgumentTest(testClient) {
  it('should support options argument', () => {
    const path = '/weather/wuhan';
    return testClient.getOptions(path)
      .then(() => testClient.tracer().expectNextSpanToEqual(testClient.successSpan({path})));
  });
}

function setupAllHttpClientTests(options) {
  const testClient = setupBasicHttpClientTests(options);
  setupOptionsArgumentTest(testClient);
  return testClient;
}

module.exports = {
  setupAllHttpClientTests,
  setupBasicHttpClientTests,
  setupOptionsArgumentTest,
  setupRedirectTest
};
