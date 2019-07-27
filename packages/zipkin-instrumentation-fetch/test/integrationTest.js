// defer lookup of node fetch until we know if we are node
const wrapFetch = require('../src/wrapFetch');

const {inBrowser} = require('../../../test/testFixture');
const clientFixture = require('../../../test/httpClientTestFixture');

describe('fetch instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    let fetch;
    if (inBrowser()) {
      fetch = window.fetch; // eslint-disable-line
    } else { // defer loading node-fetch
      fetch = require('node-fetch'); // eslint-disable-line global-require
    }

    const wrapped = wrapFetch(fetch, {tracer, remoteServiceName});
    return ({
      get(url) {
        return wrapped(url, {redirect: 'manual'});
      },
      getOptions(url) {
        return wrapped({url});
      },
      getJson(url) {
        return wrapped(url).then(response => response.json());
      }
    });
  }

  clientFixture.setupAllHttpClientTests({clientFunction});
});
