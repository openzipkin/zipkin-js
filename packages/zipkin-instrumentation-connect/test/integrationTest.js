const restify = require('restify');
const express = require('express');
const connect = require('connect');
const middleware = require('../src/middleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('connect instrumentation - integration test', () => {
  describe('restify middleware', () => {
    function serverFunction({tracer}) {
      // Restify uses async hooks. Until there is a CLS hooked implementation here, we need to be
      // explicit with trace IDs. See https://github.com/openzipkin/zipkin-js/issues/88
      function addTag(req, key, value) {
        tracer.letId(req._trace_id, () => tracer.recordBinary(key, value));
      }

      const app = restify.createServer({handleUncaughtExceptions: true});
      app.use(middleware({tracer}));
      app.get('/weather/wuhan', (req, res, next) => {
        addTag(req, 'city', 'wuhan');
        res.send(200, req.headers);
        return next();
      });
      app.get('/weather/beijing', (req, res, next) => {
        addTag(req, 'city', 'beijing');
        res.send(200, req.headers);
        return next();
      });
      app.get('/weather/peking', (req, res, next) => {
        addTag(req, 'city', 'peking');
        res.redirect('/weather/peking', next);
      });
      app.get('/weather/securedTown', (req, res, next) => {
        addTag(req, 'city', 'securedTown');
        res.send(401);
        return next();
      });
      app.get('/weather/bagCity', (req) => {
        addTag(req, 'city', 'bagCity');
        throw new Error('service is dead');
      });
      return app;
    }

    serverFixture.setupBasicHttpServerTests({serverFunction});
  });

  describe('express middleware', () => {
    function serverFunction({tracer}) {
      const app = express();
      app.use(middleware({tracer}));
      app.get('/weather/wuhan', (req, res) => {
        tracer.recordBinary('city', 'wuhan');
        res.status(200).json(req.headers);
      });
      app.get('/weather/beijing', (req, res) => {
        tracer.recordBinary('city', 'beijing');
        res.status(200).json(req.headers);
      });
      app.get('/weather/peking', (req, res) => {
        tracer.recordBinary('city', 'peking');
        res.redirect('/weather/beijing');
      });
      app.get('/weather/securedTown', (req, res) => {
        tracer.recordBinary('city', 'securedTown');
        res.send(401);
      });
      app.get('/weather/bagCity', () => {
        tracer.recordBinary('city', 'bagCity');
        throw new Error('service is dead');
      });
      return app;
    }

    serverFixture.setupAllHttpServerTests({serverFunction});
  });

  describe('connect middleware', () => {
    function serverFunction({tracer}) {
      const app = connect();
      app.use(middleware({tracer}));
      app.use('/weather/wuhan', (req, res) => {
        tracer.recordBinary('city', 'wuhan');
        res.statusCode = 200; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify(req.headers));
      });
      app.use('/weather/beijing', (req, res) => {
        tracer.recordBinary('city', 'beijing');
        res.statusCode = 200; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify(req.headers));
      });
      app.use('/weather/peking', (req, res) => {
        tracer.recordBinary('city', 'peking');
        res.writeHead(302, {Location: '/weather/beijing'});
        res.end();
      });
      app.use('/weather/securedTown', (req, res) => {
        tracer.recordBinary('city', 'securedTown');
        res.statusCode = 401; // eslint-disable-line no-param-reassign
        res.end();
      });
      app.use('/weather/bagCity', () => {
        tracer.recordBinary('city', 'bagCity');
        throw new Error('service is dead');
      });
      return app;
    }

    serverFixture.setupAllHttpServerTests({serverFunction});
  });
});
