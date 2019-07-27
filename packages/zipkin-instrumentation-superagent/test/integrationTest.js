import request from 'superagent';
import zipkinPlugin from '../src/superagentPlugin';

const clientFixture = require('../../../test/httpClientTestFixture');

describe('SuperAgent instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    // NOTE: SuperAgent is different as the plugin is added on each request!
    const plugin = zipkinPlugin({tracer, remoteServiceName});
    return ({
      get(url) {
        return request.get(url).redirects(0).use(plugin).catch((error) => {
          // Handle SuperAgent throwing on non 2xx status instead of passing to the normal callback.
          if (error.response && error.response.status) return error.response;
          throw error;
        });
      },
      getJson(url) {
        return request.get(url).use(plugin).then(response => response.body);
      }
    });
  }

  const testClient = clientFixture.setupBasicHttpClientTests({clientFunction, requestScoped: true});
  clientFixture.setupRedirectTest(testClient);
});
