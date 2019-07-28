const express = require('express');
const middleware = require('../src/expressMiddleware');

const addTestRoutes = require('./testMiddleware');
const serverFixture = require('../../../test/httpServerTestFixture');

describe('express instrumentation - integration test', () => {
  function middlewareFunction({tracer}) {
    const app = express();
    app.use(middleware({tracer}));
    addTestRoutes(app, tracer);
    return app;
  }

  serverFixture.setupAllHttpServerTests({middlewareFunction, routeBasedSpanName: true});
});
