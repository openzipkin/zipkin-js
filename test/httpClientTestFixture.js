const {expectB3Headers, setupTestServer, setupTestTracer} = require('./testFixture');

// This initially holds no state as we need to await beforeEach hook to set it up.
class TestClient {
  constructor({
    server,
    tracer,
    localServiceName,
    remoteServiceName,
    clientFunction,
  }) {
    this._server = server;
    this._tracer = tracer;
    this._localServiceName = localServiceName;
    this._clientFunction = clientFunction;
    this._remoteServiceName = remoteServiceName;
  }

  reset() {
    this._client = this._clientFunction({
      tracer: this._tracer.tracer(),
      remoteServiceName: this._remoteServiceName
    });
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

  successSpan(path) {
    return ({
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName: this._localServiceName},
      remoteEndpoint: {serviceName: this._remoteServiceName},
      tags: {
        'http.path': path,
        'http.status_code': '200'
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
// clientFixture.setupHttpClientTests({clientFunction});
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
// ### Options requests (ex. client({url})
//
// If your client supports options requests, implement getOptions(url), and set supportsOptions true
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
// const testClient = clientFixture.setupHttpClientTests({clientFunction});
// clientFixture.setupOptionsArgumentTest(testClient);
// ```
//
// ## Composition approach
//
// Approach to compose tests is from https://github.com/mochajs/mocha/wiki/Shared-Behaviours
function setupHttpClientTests({clientFunction, requestScoped = false}) {
  const localServiceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const server = setupTestServer();
  const tracer = setupTestTracer({localServiceName});
  const testClient = new TestClient({
    server,
    tracer,
    localServiceName,
    remoteServiceName,
    clientFunction
  });

  beforeEach(() => testClient.reset());

  it('should add headers to requests', () => {
    const path = '/weather/wuhan';
    return testClient.getJson(path)
      .then(json => expectB3Headers(tracer.popSpan(), json));
  });

  it('should support get request', () => {
    const path = '/weather/wuhan';
    return testClient.get({path})
      .then(() => tracer.expectNextSpanToEqual(testClient.successSpan(path)));
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

      tracer.expectSpan(firstSpan, testClient.successSpan(firstPath));
      tracer.expectNextSpanToEqual(testClient.successSpan(secondPath));
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

      tracer.expectSpan(firstSpan, testClient.successSpan(firstPath));
      tracer.expectNextSpanToEqual(testClient.successSpan(secondPath));
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

function testOptionsArgument(testClient) {
  it('should support options argument', () => {
    const path = '/weather/wuhan';
    return testClient.getOptions(path)
      .then(() => testClient.tracer().expectNextSpanToEqual(testClient.successSpan(path)));
  });
}

module.exports = {setupHttpClientTests, testOptionsArgument};
