const axios = require('axios');
const wrapAxios = require('../src/index');

const clientFixture = require('../../../test/httpClientTestFixture');

describe('axios instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    const instance = axios.create({
      timeout: 300, // this avoids flakes in CI
      maxRedirects: 0
    });

    const wrapped = wrapAxios(instance, {tracer, remoteServiceName});
    return ({
      get(url) {
        return wrapped(url).catch((error) => {
          // Handle axiosjs throwing on non 2xx status instead of passing to the normal callback.
          if (error.response && error.response.status) return error.response;
          throw error;
        });
      },
      getOptions(url) {
        return wrapped({url});
      },
      getJson(url) {
        return wrapped(url).then(response => response.data);
      }
    });
  }

  clientFixture.setupAllHttpClientTests({clientFunction});
});
