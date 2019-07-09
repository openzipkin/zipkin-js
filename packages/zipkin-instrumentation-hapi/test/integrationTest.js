const {expect} = require('chai');
const {ExplicitContext, InetAddress, Tracer} = require('zipkin');

const fetch = require('node-fetch');
const Hapi = require('hapi');
const middleware = require('../src/hapiMiddleware');
const {newSpanRecorder, expectSpan} = require('../../../test/testFixture');

describe('hapi instrumentation - integration test', () => {
  const PAUSE_TIME_MILLIS = 100;
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

  beforeEach((done) => {
    server = new Hapi.Server({
      host: 'localhost',
      port: 0
    });
    server.route({
      method: 'GET',
      path: '/weather/wuhan',
      config: {
        handler: (request, reply) => {
          tracer.recordBinary('city', 'wuhan');
          return reply.response(request.headers).code(200);
        }
      }
    });
    server.route({
      method: 'GET',
      path: '/weather/beijing',
      config: {
        handler: (request, reply) => {
          tracer.recordBinary('city', 'beijing');
          return reply.response(request.headers).code(200);
        }
      }
    });
    server.route({
      method: 'GET',
      path: '/weather/securedTown',
      config: {
        handler: (request, reply) => {
          tracer.recordBinary('city', 'securedTown');
          return reply.response(request.headers).code(401);
        }
      }
    });
    server.route({
      method: 'GET',
      path: '/weather/bagCity',
      config: {
        handler: () => {
          tracer.recordBinary('city', 'bagCity');
          throw new Error('service is dead');
        }
      }
    });
    server.route({
      method: 'GET',
      path: '/slow',
      config: {
        handler: (request, reply) => new Promise((resolve) => {
          setTimeout(
            () => resolve(reply.response(request.headers).code(202)),
            PAUSE_TIME_MILLIS
          );
        })
      }
    });
    server.register({
      plugin: middleware,
      options: {tracer}
    }).then(() => server.start())
      .then(() => {
        baseURL = `http://127.0.0.1:${server.info.port}`;
        done();
      });
  });

  afterEach(() => {
    if (server) server.stop();
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function successSpan(path, city) { // eslint-disable-line no-unused-vars
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4},
      tags: {
        'http.path': path,
        'http.status_code': '200',
        // city TODO: scoping for the handler function
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
        // city TODO: scoping for the handler function
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

  it('should record a reasonably accurate span duration', () => {
    const path = '/slow';
    const url = `${baseURL}${path}`;
    return fetch(url).then(() => {
      expect(popSpan().duration / 1000.0).to.be.greaterThan(PAUSE_TIME_MILLIS);
    });
  }); // TODO: this test isn't anywhere else

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
});
