const {expect} = require('chai');
const {InetAddress} = require('zipkin');
const fetch = require('node-fetch');

const express = require('express');
const middleware = require('../src/expressMiddleware');

const addTestRoutes = require('./testMiddleware');
const {setupTestTracer} = require('../../../test/testFixture');

describe('express instrumentation - integration test', () => {
  const serviceName = 'weather-api';
  const ipv4 = InetAddress.getLocalAddress().ipv4();

  const tracer = setupTestTracer({localServiceName: serviceName});

  let server;
  let baseURL;

  before((done) => {
    const app = express();
    app.use(middleware({tracer: tracer.tracer()}));
    addTestRoutes(app, tracer.tracer());
    server = app.listen(0, () => {
      baseURL = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after(() => {
    if (server) server.close();
  });

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
        error: status.toString(), // TODO: better error message especially on 500
        city
      }
    });
  }

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

  it('should keep context through async steps', () => {
    const path = '/steps';
    const url = `${baseURL}${path}`;
    return fetch(url).then(() => tracer.expectNextSpanToEqual({
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
