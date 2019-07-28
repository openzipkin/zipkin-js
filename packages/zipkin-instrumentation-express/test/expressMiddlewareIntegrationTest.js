const express = require('express');
const middleware = require('../src/expressMiddleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('express instrumentation - integration test', () => {
  function middlewareFunction({tracer, routes}) {
    const app = express();
    app.use(middleware({tracer}));
    routes.forEach((route) => {
      app.get(route.path, (req, res) => route.handle(req, ({redirect, body, code}) => {
        if (redirect) {
          return res.redirect(redirect);
        } else if (body) {
          return res.json(body);
        } else if (code) {
          return res.send(code);
        }
        return res.send();
      }));
    });
    return app;
  }

  serverFixture.setupAllHttpServerTests({middlewareFunction, routeBasedSpanName: true});
});
