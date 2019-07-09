const {expect} = require('chai');
const {ExplicitContext, InetAddress, Tracer} = require('zipkin');

const fetch = require('node-fetch');
const express = require('express');
const proxy = require('express-http-proxy');
const middleware = require('../src/expressMiddleware');
const wrapProxy = require('../src/wrapExpressHttpProxy');
const addTestRoutes = require('./testMiddleware');

const {newSpanRecorder, expectSpan} = require('../../../test/testFixture');

describe('express proxy instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

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

  let backend;
  let frontend;
  let baseURL;

  beforeEach((done) => {
    const backendApp = express();
    addTestRoutes(backendApp, tracer);
    backend = backendApp.listen(0, () => {
      const frontendApp = express();
      const zipkinProxy = wrapProxy(proxy, {tracer, serviceName, remoteServiceName});
      frontendApp.use(middleware({tracer}));
      frontendApp.use(zipkinProxy(`127.0.0.1:${backend.address().port}`, {
        decorateRequest: (proxyReq) => {
          tracer.recordBinary('decorateRequest', '');
          return proxyReq;
        },
        intercept: (rsp, data, originalReq, res, callback) => {
          tracer.recordBinary('intercept', '');
          callback(null, data);
        }
      }));

      frontend = frontendApp.listen(0, () => {
        baseURL = `http://127.0.0.1:${frontend.address().port}`;
        done();
      });
    });
  });

  afterEach(() => {
    if (frontend) frontend.close();
    if (backend) backend.close();
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function successServerSpan(path, city) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': '200',
        decorateRequest: '',
        intercept: '',
        city
      }
    });
  }

  function successClientSpan(path, parentId) {
    return ({
      parentId,
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName, port: backend.address().port},
      tags: {
        'http.path': path,
        'http.status_code': '200',
      }
    });
  }

  it('should start a new trace', () => {
    const path = '/weather/wuhan';
    const url = `${baseURL}${path}`;
    return fetch(url).then(() => {
      const serverSpan = popSpan();
      expectSpan(serverSpan, successServerSpan(path, 'wuhan'));
      expectSpan(popSpan(), successClientSpan(path, serverSpan.id));
    });
  });

  it('http.path tag should not include query parameters', () => {
    const path = '/weather/wuhan';
    const url = `${baseURL}${path}?index=10&count=300`;
    return fetch(url).then(() => {
      expect(popSpan().tags['http.path']).to.equal(path); // server
      expect(popSpan().tags['http.path']).to.equal(path); // client
    });
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
      const serverSpan = popSpan();
      expect(serverSpan.traceId).to.equal('863ac35c9f6413ad');
      expect(serverSpan.id).to.equal('48485a3953bb6124');
      expect(serverSpan.debug).to.equal(true);
      expect(serverSpan.shared).to.equal(true);

      const clientSpan = popSpan();
      expect(clientSpan.traceId).to.equal(serverSpan.traceId);
      expect(clientSpan.parentId).to.equal(serverSpan.id);
      expect(clientSpan.debug).to.equal(true);
      expect(clientSpan.shared).to.not.exist; // eslint-disable-line no-unused-expressions
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
    }).then(() => {
      expect(popSpan().traceId).to.equal(traceId); // server
      expect(popSpan().traceId).to.equal(traceId); // client
    });
  });

  it('should report 500 in tags', () => {
    backend.close();
    const path = '/weather/wuhan';
    return fetch(`${baseURL}${path}`).then(() => expectSpan(popSpan(), {
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': '500',
        error: '500', // TODO: better error message
        decorateRequest: ''
      }
    }));
  });
});
