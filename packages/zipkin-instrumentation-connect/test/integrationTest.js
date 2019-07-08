const {expect} = require('chai');
const {ExplicitContext, InetAddress, Tracer} = require('zipkin');

const fetch = require('node-fetch');
const restify = require('restify');
const express = require('express');
const connect = require('connect');
const https = require('https');
const fs = require('fs');
const middleware = require('../src/middleware');
const {newSpanRecorder, expectSpan} = require('../../../test/testFixture');

describe('connect instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const ipv4 = InetAddress.getLocalAddress().ipv4();

  let spans;
  let tracer;

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({
      localServiceName: serviceName,
      ctxImpl: new ExplicitContext(),
      recorder: newSpanRecorder(spans)
    });
  });

  let server;
  let baseURL;

  afterEach(() => {
    if (server) server.close();
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function successSpan(path) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': '202',
        message: 'hello from within app'
      }
    });
  }

  function errorSpan(path, status) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': status.toString(),
        error: status.toString(),
        message: 'testing error annotation recording'
      }
    });
  }

  describe('restify middleware', () => {
    beforeEach((done) => {
      const app = restify.createServer();
      app.use(middleware({tracer}));
      app.get('/foo', (req, res, next) => {
        tracer.recordBinary('message', 'hello from within app');
        res.send(202, {status: 'OK'});
        return next();
      });
      app.get('/pathno', (req, res, next) => {
        tracer.recordBinary('message', 'testing error annotation recording');
        res.send(404, {status: 'Not Found'});
        return next();
      });
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });

    it('should start a new trace', () => {
      const path = '/foo';
      const url = `${baseURL}${path}`;
      return fetch(url).then(() => expectSpan(popSpan(), successSpan(path)));
    });

    it('should receive continue a trace from the client', () => {
      const path = '/foo';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': '863ac35c9f6413ad',
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Flags': '1'
        }
      }).then(() => {
        const span = popSpan();
        expect(span.traceId).to.equal('863ac35c9f6413ad');
        expect(span.id).to.equal('48485a3953bb6124');

        expectSpan(span, {...successSpan(path), ...{debug: true, shared: true}});
      });
    });

    it('should accept a 128bit X-B3-TraceId', () => {
      const traceId = '863ac35c9f6413ad48485a3953bb6124';
      const path = '/foo';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Sampled': '1'
        }
      }).then(() => expect(popSpan().traceId).to.equal(traceId));
    });

    it('should record error on status <200 or >399', () => {
      const path = '/pathno';
      return fetch(`${baseURL}${path}`)
        .then(() => expectSpan(popSpan(), errorSpan(path, 404)));
    });
  });

  describe('express middleware', () => {
    beforeEach((done) => {
      const app = express();
      app.use(middleware({tracer}));
      app.get('/foo', (req, res) => {
        tracer.recordBinary('message', 'hello from within app');
        res.status(202).json({status: 'OK'});
      });
      app.get('/pathno', (req, res) => {
        tracer.recordBinary('message', 'testing error annotation recording');
        res.status(404).json({status: 'Not Found'});
      });
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });

    it('should start a new trace', () => {
      const path = '/foo';
      const url = `${baseURL}${path}`;
      return fetch(url).then(() => expectSpan(popSpan(), successSpan(path)));
    });

    it('should receive continue a trace from the client', () => {
      const path = '/foo';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': '863ac35c9f6413ad',
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Flags': '1'
        }
      }).then(() => {
        const span = popSpan();
        expect(span.traceId).to.equal('863ac35c9f6413ad');
        expect(span.id).to.equal('48485a3953bb6124');

        expectSpan(span, {...successSpan(path), ...{debug: true, shared: true}});
      });
    });

    it('should accept a 128bit X-B3-TraceId', () => {
      const traceId = '863ac35c9f6413ad48485a3953bb6124';
      const path = '/foo';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Sampled': '1'
        }
      }).then(() => expect(popSpan().traceId).to.equal(traceId));
    });

    it('should record error on status <200 or >399', () => {
      const path = '/pathno';
      return fetch(`${baseURL}${path}`)
        .then(() => expectSpan(popSpan(), errorSpan(path, 404)));
    });
  });

  describe('connect middleware', () => {
    let app; // exposed for TLS test

    beforeEach((done) => {
      app = connect();
      app.use(middleware({tracer}));
      app.use('/pathno', (req, res) => {
        tracer.recordBinary('message', 'testing error annotation recording');
        res.statusCode = 404; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify({status: 'Not Found'}));
      });
      app.use('/foo', (req, res) => {
        tracer.recordBinary('message', 'hello from within app');
        res.statusCode = 202; // eslint-disable-line no-param-reassign
        res.end(JSON.stringify({status: 'OK'}));
      });
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        done();
      });
    });


    it('should start a new trace', () => {
      const path = '/foo';
      return fetch(`${baseURL}${path}`).then(() => expectSpan(popSpan(), successSpan(path)));
    });

    it('should receive continue a trace from the client', () => {
      const path = '/foo';
      return fetch(`${baseURL}${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': '863ac35c9f6413ad',
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Flags': '1'
        }
      }).then(() => {
        const span = popSpan();
        expect(span.traceId).to.equal('863ac35c9f6413ad');
        expect(span.id).to.equal('48485a3953bb6124');

        expectSpan(span, {...successSpan(path), ...{debug: true, shared: true}});
      });
    });

    it('should accept a 128bit X-B3-TraceId', () => {
      const traceId = '863ac35c9f6413ad48485a3953bb6124';
      const path = '/foo';
      return fetch(`${baseURL}/${path}`, {
        method: 'get',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': '48485a3953bb6124',
          'X-B3-Sampled': '1'
        }
      }).then(() => expect(popSpan().traceId).to.equal(traceId));
    });

    it('should record error on status <200 or >399', () => {
      const path = '/pathno';
      return fetch(`${baseURL}${path}`)
        .then(() => expectSpan(popSpan(), errorSpan(path, 404)));
    });

    it('should work with https', (done) => {
      const tlsOptions = {
        rejectUnauthorized: false,
        key: fs.readFileSync('test/keys/server.key'),
        cert: fs.readFileSync('test/keys/server.crt')
      };

      const tlsServer = https.createServer(tlsOptions, app);
      const port = 4443;
      tlsServer.listen(port, () => {
        const path = '/foo';
        fetch(`https://localhost:${port}${path}`, {
          agent: new https.Agent({rejectUnauthorized: false})
        }).then(() => {
          expectSpan(popSpan(), successSpan(path));
          done();
        })
          .catch(err => done(err))
          .finally(() => tlsServer.close());
      });
    });
  });
});
