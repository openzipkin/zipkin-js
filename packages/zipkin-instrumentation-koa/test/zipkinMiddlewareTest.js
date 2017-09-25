const zipkinMiddleware = require('../src/zipkinMiddleware');
const Koa = require('koa');

const {Tracer, ExplicitContext} = require('zipkin');

const fetch = require('node-fetch');

describe('zipkinMiddlewareTest', () => {
  let app;
  let server;
  let tracer;
  let records;
  let binaryRecords;

  before(() => {
    const record = (rec) => {
      if (rec.annotation.annotationType !== 'BinaryAnnotation') {
        records[rec.annotation.annotationType] = rec;
      } else {
        binaryRecords[rec.annotation.key] = rec;
      }
    };
    tracer = new Tracer({ctxImpl: new ExplicitContext(), recorder: {record}});
  });

  beforeEach(() => {
    app = new Koa();
    records = {};
    binaryRecords = {};
  });

  afterEach(done => {
    server.close(done);
  });

  it('should record annotations for root span', done => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use(ctx => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post'}).then(() => {
        expect(records['ServiceName'].annotation).not.to.be.undefined;
        expect(records['ServiceName'].annotation.serviceName).to.be.equal('foo-service');

        expect(records['Rpc'].annotation).to.not.be.defined;
        expect(records['Rpc'].annotation.name).to.not.be.equal('get');

        expect(records['LocalAddr'].annotation).not.to.be.undefined;
        expect(records['ServerRecv'].annotation).not.to.be.undefined;
        expect(records['ServerSend'].annotation).not.to.be.undefined;

        expect(binaryRecords['http.url'].annotation).not.to.be.undefined;
        expect(binaryRecords['http.url'].annotation.value).to.be.equal('/foo');

        expect(binaryRecords['http.status_code'].annotation).not.to.be.undefined;
        expect(binaryRecords['http.status_code'].annotation.value).to.be.equal('201');

        const traceId = records['ServiceName'].traceId;
        expect(traceId.traceId).to.have.lengthOf(16);
        expect(traceId.spanId).to.be.equal(traceId.traceId);
        expect(traceId.parentId).to.be.equal(traceId.spanId);

        Object.keys(records).forEach(rec => {
          expect(records[rec].traceId.traceId).to.be.equal(traceId.traceId);
          expect(records[rec].traceId.spanId).to.be.equal(traceId.spanId);
          expect(records[rec].traceId.parentId).to.be.equal(traceId.parentId);
        });
        done();
      }).catch(done);
    });
  });

  it('should record annotation for child span', done => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service', port: 3002}));
    app.use(ctx => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const headers = {
        'X-B3-TraceId': 'trace1d',
        'X-B3-SpanId': '5pan1d',
        'X-B3-ParentSpanId': 'parent5pan1d'
      };
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post', headers}).then(() => {
        expect(records['ServiceName'].annotation).not.to.be.undefined;
        expect(records['ServiceName'].annotation.serviceName).to.be.equal('foo-service');

        expect(records['Rpc'].annotation).to.not.be.defined;
        expect(records['Rpc'].annotation.name).to.not.be.equal('get');

        expect(records['LocalAddr'].annotation).not.to.be.undefined;
        expect(records['LocalAddr'].annotation.port).to.be.equal(3002);

        expect(records['ServerRecv'].annotation).not.to.be.undefined;
        expect(records['ServerSend'].annotation).not.to.be.undefined;

        expect(binaryRecords['http.url'].annotation).not.to.be.undefined;
        expect(binaryRecords['http.url'].annotation.value).to.be.equal('/foo');

        expect(binaryRecords['http.status_code'].annotation).not.to.be.undefined;
        expect(binaryRecords['http.status_code'].annotation.value).to.be.equal('201');

        const traceId = records['ServiceName'].traceId;
        expect(traceId.traceId).to.be.equal('trace1d');
        expect(traceId.spanId.value).to.be.equal('5pan1d');
        expect(traceId.parentId).to.be.equal('parent5pan1d');

        Object.keys(records).forEach(rec => {
          expect(records[rec].traceId.traceId).to.be.equal(traceId.traceId);
          expect(records[rec].traceId.spanId).to.be.equal(traceId.spanId);
          expect(records[rec].traceId.parentId).to.be.equal(traceId.parentId);
        });
        done();
      }).catch(done);
    });
  });

  it('should handle absence of optional headers', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use(ctx => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const headers = {
        'X-B3-TraceId': 'trace1d',
        'X-B3-SpanId': '5pan1d'
      };
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post', headers}).then(() => {
        expect(records['ServiceName'].annotation).not.to.be.undefined;

        const traceId = records['ServiceName'].traceId;
        expect(traceId.traceId).to.be.equal('trace1d');
        expect(traceId.spanId.value).to.be.equal('5pan1d');
        expect(traceId.parentId).to.be.equal(traceId.spanId);
        done();
      }).catch(done);
    });
  });
});
