const {expect} = require('chai');
const {InetAddress} = require('zipkin');
const fetch = require('node-fetch');
const https = require('https');
const fs = require('fs');

const restify = require('restify');
const express = require('express');
const connect = require('connect');

const middleware = require('../src/middleware');
const {setupTestTracer} = require('../../../test/testFixture');

describe('connect instrumentation - integration test', () => {
  const serviceName = 'weather-api';
  const ipv4 = InetAddress.getLocalAddress().ipv4();

  const tracer = setupTestTracer({localServiceName: serviceName});

  let server;
  let baseURL;

  after(() => {
    if (server) server.close();
  });

  function successSpan(path, city) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': '200',
        city
      }
    });
  }

  function errorSpan(path, city, status) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': status.toString(),
        error: status.toString(), // TODO: better error message especially on 500
        city
      }
    });
  }

  describe('restify middleware', () => {
    // Restify uses async hooks. Until there is a CLS hooked implementation here, we need to be
    // explicit with trace IDs. See https://github.com/openzipkin/zipkin-js/issues/88
    function addTag(req, key, value) {
      tracer.tracer().letId(req._trace_id, () => tracer.tracer().recordBinary(key, value));
    }

    before((done) => {
      const app = restify.createServer({handleUncaughtExceptions: true});
      app.use(middleware({tracer: tracer.tracer()}));
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
      app.get('/weather/securedTown', (req, res, next) => {
        addTag(req, 'city', 'securedTown');
        res.send(401, req.headers);
        return next();
      });
      app.get('/weather/bagCity', (req) => {
        addTag(req, 'city', 'bagCity');
        throw new Error('service is dead');
      });
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });

    it('should start a new trace', () => {
      const path = '/weather/wuhan';
      const url = `${baseURL}${path}`;
      return fetch(url).then(() => tracer.expectNextSpanToEqual(successSpan(path, 'wuhan')));
    });

    it('http.path tag should not include query parameters', () => {
      const path = '/weather/wuhan';
      const url = `${baseURL}${path}?index=10&count=300`;
      return fetch(url).then(() => expect(tracer.popSpan().tags['http.path']).to.equal(path));
    });

    it('should receive continue a trace from the client', () => {
      const path = '/weather/wuhan';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': '863ac35c9f6413ad',
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Flags': '1'
        }
      }).then(() => {
        const span = tracer.expectNextSpanToEqual(
          {...successSpan(path, 'wuhan'), ...{debug: true, shared: true}}
        );
        expect(span.traceId).to.equal('863ac35c9f6413ad');
        expect(span.id).to.equal('48485a3953bb6124');
      });
    });

    it('should accept a 128bit X-B3-TraceId', () => {
      const traceId = '863ac35c9f6413ad48485a3953bb6124';
      const path = '/weather/wuhan';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Sampled': '1'
        }
      }).then(() => expect(tracer.popSpan().traceId).to.equal(traceId));
    });

    it('should report 401 in tags', () => {
      const path = '/weather/securedTown';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(errorSpan(path, 'securedTown', 401)));
    });

    it('should report 500 in tags', () => {
      const path = '/weather/bagCity';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(errorSpan(path, 'bagCity', 500)));
    });
  });

  describe('express middleware', () => {
    before((done) => {
      const app = express();
      app.use(middleware({tracer: tracer.tracer()}));
      app.get('/weather/wuhan', (req, res) => {
        tracer.tracer().recordBinary('city', 'wuhan');
        res.status(200).json(req.headers);
      });
      app.get('/weather/beijing', (req, res) => {
        tracer.tracer().recordBinary('city', 'beijing');
        res.status(200).json(req.headers);
      });
      app.get('/weather/securedTown', (req, res) => {
        tracer.tracer().recordBinary('city', 'securedTown');
        res.status(401).json(req.headers);
      });
      app.get('/weather/bagCity', () => {
        tracer.tracer().recordBinary('city', 'bagCity');
        throw new Error('service is dead');
      });
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });

    it('should start a new trace', () => {
      const path = '/weather/wuhan';
      const url = `${baseURL}${path}`;
      return fetch(url).then(() => tracer.expectNextSpanToEqual(successSpan(path, 'wuhan')));
    });

    it('http.path tag should not include query parameters', () => {
      const path = '/weather/wuhan';
      const url = `${baseURL}${path}?index=10&count=300`;
      return fetch(url).then(() => expect(tracer.popSpan().tags['http.path']).to.equal(path));
    });

    it('should receive continue a trace from the client', () => {
      const path = '/weather/wuhan';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': '863ac35c9f6413ad',
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Flags': '1'
        }
      }).then(() => {
        const span = tracer.expectNextSpanToEqual(
          {...successSpan(path, 'wuhan'), ...{debug: true, shared: true}}
        );
        expect(span.traceId).to.equal('863ac35c9f6413ad');
        expect(span.id).to.equal('48485a3953bb6124');
      });
    });

    it('should accept a 128bit X-B3-TraceId', () => {
      const traceId = '863ac35c9f6413ad48485a3953bb6124';
      const path = '/weather/wuhan';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Sampled': '1'
        }
      }).then(() => expect(tracer.popSpan().traceId).to.equal(traceId));
    });

    it('should report 401 in tags', () => {
      const path = '/weather/securedTown';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(errorSpan(path, 'securedTown', 401)));
    });

    it('should report 500 in tags', () => {
      const path = '/weather/bagCity';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(errorSpan(path, 'bagCity', 500)));
    });
  });

  describe('connect middleware', () => {
    let app; // exposed for TLS test

    before((done) => {
      app = connect();
      app.use(middleware({tracer: tracer.tracer()}));
      app.use('/weather/wuhan', (req, res) => {
        tracer.tracer().recordBinary('city', 'wuhan');
        res.statusCode = 200; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify(req.headers));
      });
      app.use('/weather/beijing', (req, res) => {
        tracer.tracer().recordBinary('city', 'beijing');
        res.statusCode = 200; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify(req.headers));
      });
      app.use('/weather/securedTown', (req, res) => {
        tracer.tracer().recordBinary('city', 'securedTown');
        res.statusCode = 401; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify(req.headers));
      });
      app.use('/weather/bagCity', () => {
        tracer.tracer().recordBinary('city', 'bagCity');
        throw new Error('service is dead');
      });
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });

    it('should start a new trace', () => {
      const path = '/weather/wuhan';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(successSpan(path, 'wuhan')));
    });

    it('http.path tag should not include query parameters', () => {
      const path = '/weather/wuhan';
      const url = `${baseURL}${path}?index=10&count=300`;
      return fetch(url).then(() => expect(tracer.popSpan().tags['http.path']).to.equal(path));
    });

    it('should receive continue a trace from the client', () => {
      const path = '/weather/wuhan';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': '863ac35c9f6413ad',
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Flags': '1'
        }
      }).then(() => {
        const span = tracer.expectNextSpanToEqual(
          {...successSpan(path, 'wuhan'), ...{debug: true, shared: true}}
        );
        expect(span.traceId).to.equal('863ac35c9f6413ad');
        expect(span.id).to.equal('48485a3953bb6124');
      });
    });

    it('should accept a 128bit X-B3-TraceId', () => {
      const traceId = '863ac35c9f6413ad48485a3953bb6124';
      const path = '/weather/wuhan';
      return fetch(`${baseURL}/${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Sampled': '1'
        }
      }).then(() => expect(tracer.popSpan().traceId).to.equal(traceId));
    });

    it('should report 401 in tags', () => {
      const path = '/weather/securedTown';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(errorSpan(path, 'securedTown', 401)));
    });

    it('should report 500 in tags', () => {
      const path = '/weather/bagCity';
      return fetch(`${baseURL}${path}`)
        .then(() => tracer.expectNextSpanToEqual(errorSpan(path, 'bagCity', 500)));
    });

    it('should work with https', (done) => {
      const tlsOptions = {
        rejectUnauthorized: false,
        key: fs.readFileSync('test/keys/server.key'),
        cert: fs.readFileSync('test/keys/server.crt')
      };

      const tlsServer = https.createServer(tlsOptions, app);
      tlsServer.listen(0, () => {
        const path = '/weather/wuhan';
        fetch(`https://localhost:${tlsServer.address().port}${path}`, {
          agent: new https.Agent({rejectUnauthorized: false})
        }).then(() => {
          tlsServer.close(); // closing here because in travis env, finally syntax doesn't work.

          tracer.expectNextSpanToEqual(successSpan(path, 'wuhan'));
          done();
        })
          .catch(err => done(err));
      });
    });
  });
});
