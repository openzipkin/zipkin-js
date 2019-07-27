const got = require('got');
const wrapGot = require('../src/wrapGot');

const clientFixture = require('../../../test/httpClientTestFixture');

describe('got instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    const wrapped = wrapGot(got, {tracer, remoteServiceName});
    return ({
      get(url) {
        return wrapped(url, {retry: 0, followRedirect: false}).catch((error) => {
          // Handle gotjs throwing on non 2xx status instead of passing to the normal callback.
          if (error.response && error.response.statusCode) return error.response;
          throw error;
        });
      },
      getOptions(url) {
        return wrapped({url});
      },
      getJson(url) {
        return wrapped(url).then(response => JSON.parse(response.body));
      }
    });
  }

  clientFixture.setupAllHttpClientTests({clientFunction});
});
