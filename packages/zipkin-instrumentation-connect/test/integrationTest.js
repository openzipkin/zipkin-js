const restify = require('restify');
const express = require('express');
const connect = require('connect');
const middleware = require('../src/middleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('connect instrumentation - integration test', () => {
  describe('restify middleware', () => {
    // Restify uses async hooks. Until there is a CLS hooked implementation here, we need to be
    // explicit with trace IDs. See https://github.com/openzipkin/zipkin-js/issues/88
    function addTag(tracer, req, key, value) {
      tracer.letId(req._trace_id, () => tracer.recordBinary(key, value));
    }

    function middlewareFunction({tracer, routes}) {
      const app = restify.createServer({handleUncaughtExceptions: true});
      app.use(middleware({tracer}));
      routes.forEach((route) => {
        app.get(route.path, (req, res, next) => route.handle(req, ({redirect, body, code}) => {
          if (redirect) {
            return res.redirect('/weather/peking', next);
          } else if (body) {
            return res.send(body);
          } else if (code) {
            return res.send(code);
          }
          return res.send();
        }));
      });
      return app;
    }

    serverFixture.setupBasicHttpServerTests({middlewareFunction, addTag});
  });

  describe('express middleware', () => {
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

    serverFixture.setupAllHttpServerTests({middlewareFunction});
  });

  describe('connect middleware', () => {
    function middlewareFunction({tracer, routes}) {
      const app = connect();
      app.use(middleware({tracer}));
      routes.forEach((route) => {
        app.use(route.path, (req, res) => route.handle(req, ({redirect, body, code}) => {
          if (redirect) {
            res.writeHead(302, {Location: redirect});
          } else if (body) {
            return res.end(JSON.stringify(req.headers));
          } else if (code) {
            res.statusCode = code; // eslint-disable-line no-param-reassign
          }
          return res.end();
        }));
      });
      return app;
    }

    serverFixture.setupAllHttpServerTests({middlewareFunction});
  });
});
