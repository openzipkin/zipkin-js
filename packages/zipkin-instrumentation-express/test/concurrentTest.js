const EventEmitter = require('events');
const express = require('express');
const request = require('supertest');
const {Tracer} = require('zipkin');
const {expressMiddleware} = require('zipkin-instrumentation-express');
const CLSContext = require('zipkin-context-cls');

describe('concurrent request', () => {
  let app;
  let tracer;
  let ctxImpl;
  let eventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();

    app = express();
    ctxImpl = new CLSContext('zipkin', true);
    const recorder = {record() {}};
    tracer = new Tracer({ctxImpl, recorder});

    app.use(expressMiddleware({tracer}));

    app.get('/', (req, res) => {
      const concurrentRequestStarted = new Promise(resolve => eventEmitter.on('concurrent-request-started', resolve));
      console.log('request-started', tracer.id.traceId);
      eventEmitter.emit('request-started');
      return concurrentRequestStarted.then(() => {
        eventEmitter.emit('request-resumed');
        console.log('request-resumed', tracer.id.traceId);
        res.send(tracer.id.traceId);
      });
    });

    app.get('/concurrent', (req, res) => {
      const requestResumed = new Promise(resolve => eventEmitter.on('request-resumed', resolve));

      console.log('concurrent-request-started', tracer.id.traceId);
      eventEmitter.emit('concurrent-request-started');
      res.send(tracer.id.traceId);
      return requestResumed;
    });
  });

  it('uses correct context during a concurrent request', () => {
    eventEmitter.on('request-started', () => {
      request(app)
        .get('/concurrent')
        .set('x-b3-parentspanid', '1f8eb2f526d2343d')
        .set('x-b3-spanid', '1f8eb2f526d2343d')
        .set('x-b3-traceid', '1f8eb2f526d2343d')
        .set('x-b3-sampled', '1')
        .expect('1f8eb2f526d2343d')
        .then();
    });

    return request(app)
      .get('/')
      .set('x-b3-parentspanid', '6d5efc020997e0fe')
      .set('x-b3-spanid', '9756d5ddb78eb57b')
      .set('x-b3-traceid', '6d5efc020997e0fe')
      .set('x-b3-sampled', '1')
      .expect('6d5efc020997e0fe');
  });
});
