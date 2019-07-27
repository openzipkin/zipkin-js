const request = require('request');
const wrapRequest = require('../src/index');

const clientFixture = require('../../../test/httpClientTestFixture');

describe('request instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    const wrapped = wrapRequest(request, {tracer, remoteServiceName});
    // Intentionally doesn't use node.js promisify to work in browser and to be explicit.
    return ({
      get(url) {
        return new Promise((resolve, reject) => wrapped.get(url, (error, response) => {
          if (error) reject(error);
          resolve(response);
        }));
      },
      getOptions(url) {
        return new Promise((resolve, reject) => wrapped({url}, (error, response) => {
          if (error) reject(error);
          resolve(response);
        }));
      },
      getJson(url) {
        return new Promise((resolve, reject) => wrapped({url}, (error, response, data) => {
          if (error) reject(error);
          resolve(JSON.parse(data));
        }));
      }
    });
  }

  const testClient = clientFixture.setupHttpClientTests({clientFunction});
  clientFixture.testOptionsArgument(testClient);
});
