const zipkinMiddleware = require('../src/zipkinMiddleware');
const Koa = require('koa');

const {Tracer, ExplicitContext} = require('zipkin');

const request = require('supertest');

describe('zipkinMiddlewareTest', () => {
  let annotations;
  let binaryAnnotations;
  let tracer;

  before(() => {
    const record = (rec) => {
      if (rec.annotation.annotationType !== 'BinaryAnnotation') {
        annotations[rec.annotation.annotationType] = rec.annotation;
      } else {
        binaryAnnotations[rec.annotation.key] = rec.annotation;
      }
    };
    tracer = new Tracer({ctxImpl: new ExplicitContext(), recorder: {record}});
  });

  beforeEach(() => {
    annotations = {};
    binaryAnnotations = {};
  });

  it('should record annotations for root span', (done) => {
    const app = new Koa();
    app.use(zipkinMiddleware({tracer, serviceName: 'dummy-service', port: 1234}));
    app.use(ctx => {
      ctx.status = 201;
    });
    request(app.callback()).get('/test').end(() => {
      expect(annotations['ServiceName']).not.to.be.undefined;
      expect(annotations['ServiceName'].serviceName).to.be.equal('dummy-service');

      expect(annotations['Rpc']).to.not.be.defined;
      expect(annotations['Rpc'].name).to.not.be.equal('get');

      expect(annotations['LocalAddr']).not.to.be.undefined;
      expect(annotations['ServerRecv']).not.to.be.undefined;
      expect(annotations['ServerSend']).not.to.be.undefined;

      expect(binaryAnnotations['http.url']).not.to.be.undefined;
      expect(binaryAnnotations['http.url'].value).to.be.equal('/test');

      expect(binaryAnnotations['http.status_code']).not.to.be.undefined;
      expect(binaryAnnotations['http.status_code'].value).to.be.equal('201');
      done();
    });
  });
});
