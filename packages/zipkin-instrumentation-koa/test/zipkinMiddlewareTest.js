const zipkinMiddleware = require('../src/zipkinMiddleware');
const Koa = require('koa');

const {Tracer, ExplicitContext} = require('zipkin');

const fetch = require('node-fetch');

describe('zipkinMiddlewareTest', () => {
  let app;
  let server;
  let tracer;
  let annotations;
  let binaryAnnotations;

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
    app = new Koa();
    annotations = {};
    binaryAnnotations = {};
  });

  afterEach(done => {
    server.close(done);
  });

  it('should record annotations for root span', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service', port: 1234}));
    app.use(ctx => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post'}).then(() => {
        expect(annotations['ServiceName']).not.to.be.undefined;
        expect(annotations['ServiceName'].serviceName).to.be.equal('foo-service');

        expect(annotations['Rpc']).to.not.be.defined;
        expect(annotations['Rpc'].name).to.not.be.equal('get');

        expect(annotations['LocalAddr']).not.to.be.undefined;
        expect(annotations['ServerRecv']).not.to.be.undefined;
        expect(annotations['ServerSend']).not.to.be.undefined;

        expect(binaryAnnotations['http.url']).not.to.be.undefined;
        expect(binaryAnnotations['http.url'].value).to.be.equal('/foo');

        expect(binaryAnnotations['http.status_code']).not.to.be.undefined;
        expect(binaryAnnotations['http.status_code'].value).to.be.equal('201');
      }).then(done)
        .catch(done);
    });
  });
});
