const zipkinMiddleware = require('../src/zipkinMiddleware');
const Koa = require('koa');

const {Tracer, ExplicitContext} = require('zipkin');

const sinon = require('sinon');
const fetch = require('node-fetch');

describe('zipkinMiddlewareTest', () => {

  let annotations;
  let tracer;

  before(() => {
    const record = (rec) => annotations.push(rec.annotation);
    tracer = new Tracer({ctxImpl: new ExplicitContext(), recorder: {record}});
  });

  beforeEach(() => {
    annotations = [];
  });

  it('should record annotations for root span', (done) => {
    const app = new Koa();
    app.use(zipkinMiddleware(tracer));
    app.use(ctx => {
      ctx.status = 200;
    });
    request(app.callback()).get('/test').end((err, res) => {
      expect(annotations[0].annotationType).to.be.equal('ServiceName');
      expect(annotations[1].annotationType).to.be.equal('Rpc');
      expect(annotations[2].annotationType).to.be.equal('BinaryAnnotation');
      expect(annotations[3].annotationType).to.be.equal('ServerRecv');
      expect(annotations[4].annotationType).to.be.equal('LocalAddr');
      expect(annotations[5].annotationType).to.be.equal('BinaryAnnotation');
      expect(annotations[6].annotationType).to.be.equal('ServerSend');
      done();
    });
  });
});
