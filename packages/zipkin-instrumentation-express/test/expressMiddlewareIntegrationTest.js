const {expect} = require('chai');
const {ExplicitContext, InetAddress, Tracer} = require('zipkin');

const fetch = require('node-fetch');
const express = require('express');
const middleware = require('../src/expressMiddleware');

const {newSpanRecorder, expectSpan} = require('../../../test/testFixture');

describe('express instrumentation - integration test', () => {
  const serviceName = 'weather-api';
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

  function step(num) {
    return new Promise((done) => {
      setTimeout(() => {
        tracer.scoped(() => {
          tracer.recordBinary('step', num.toString());
          done();
        });
      }, 10);
    });
  }

  beforeEach((done) => {
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
    app.get('/weather/securedTown', (req, res) => {
      tracer.recordBinary('city', 'securedTown');
      res.status(401).json(req.headers);
    });
    app.get('/weather/bagCity', (req, res, next) => {
      tracer.recordBinary('city', 'bagCity');
      next(new Error('service is dead'));
    });
    app.get('/steps', (req, res) => step(1)
      .then(() => step(2))
      .then(() => step(3))
      .then(() => res.status(200).json(req.headers)));
    server = app.listen(0, () => {
      baseURL = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  afterEach(() => {
    if (server) server.close();
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function successSpan(path, city) {
    return ({
      name: `get ${path.toLowerCase()}`, // TODO: show routes w/ variables aren't path literals
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
      name: `get ${path.toLowerCase()}`,
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': status.toString(),
        error: status.toString(),
        city
      }
    });
  }

  it('should start a new trace', () => {
    const path = '/weather/wuhan';
    const url = `${baseURL}${path}`;
    return fetch(url).then(() => expectSpan(popSpan(), successSpan(path, 'wuhan')));
  });

  it('http.path tag should not include query parameters', () => {
    const path = '/weather/wuhan';
    const url = `${baseURL}${path}?index=10&count=300`;
    return fetch(url).then(() => expect(popSpan().tags['http.path']).to.equal(path));
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
      const span = popSpan();
      expect(span.traceId).to.equal('863ac35c9f6413ad');
      expect(span.id).to.equal('48485a3953bb6124');

      expectSpan(span, {...successSpan(path, 'wuhan'), ...{debug: true, shared: true}});
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
    }).then(() => expect(popSpan().traceId).to.equal(traceId));
  });

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    return fetch(`${baseURL}${path}`)
      .then(() => expectSpan(popSpan(), errorSpan(path, 'securedTown', 401)));
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    return fetch(`${baseURL}${path}`)
      .then(() => expectSpan(popSpan(), errorSpan(path, 'bagCity', 500)));
  });

  it('should keep context through async steps', () => {
    const path = '/steps';
    const url = `${baseURL}${path}`;
    return fetch(url).then(() => expectSpan(popSpan(), {
      name: `get ${path.toLowerCase()}`,
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': '200',
        step: '3'
      }
    }));
  });
});
