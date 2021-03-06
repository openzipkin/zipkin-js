// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

const rest = require('rest');
const restInterceptor = require('../src/restInterceptor');

const clientFixture = require('../../../test/httpClientTestFixture');

describe('CujoJS/rest instrumentation - integration test', () => {
  function clientFunction({tracer, remoteServiceName}) {
    const wrapped = rest.wrap(restInterceptor, {tracer, remoteServiceName});
    return ({
      get(url) {
        return wrapped(url);
      },
      getJson(url) {
        return wrapped(url).then(response => JSON.parse(response.entity));
      }
    });
  }

  clientFixture.setupBasicHttpClientTests({clientFunction});
});
