const ZipkinRequest = require('../src/request').default;

const clientFixture = require('../../../test/httpClientTestFixture');

describe('request-promise instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    // NOTE: this is instantiated differently than others: you don't pass in a request function
    const client = new ZipkinRequest(tracer, remoteServiceName);
    return ({
      get(url) {
        return client.get({url, followRedirect: false}).catch((error) => {
          // Handle request-promise throwing on non 2xx instead of passing to the normal callback.
          if (error.response && error.response.statusCode) return error.response;
          throw error;
        });
      },
      getJson(url) {
        return client.get(url).then(response => JSON.parse(response));
      }
    });
  }

  const testClient = clientFixture.setupBasicHttpClientTests({clientFunction});
  clientFixture.setupRedirectTest(testClient);
});
