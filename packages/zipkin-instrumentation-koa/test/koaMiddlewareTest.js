const fetch = require('node-fetch');
const {Tracer, ExplicitContext} = require('zipkin');
const Koa = require('koa');

const zipkinMiddleware = require('../src/koaMiddleware');

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

  afterEach((done) => {
    server.close(done);
  });

  it('should record annotations for root span', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use((ctx) => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const url = `http://localhost:${server.address().port}/foo?query=test`;
      const headers = {
        'X-B3-TraceId': 'aaa-123',
        'X-B3-SpanId': 'aaa-123',
        'X-B3-Sampled': '1'
      };
      fetch(url, {method: 'post', headers}).then(() => {
        expect(records.ServiceName).to.be.not.equal(undefined);
        expect(records.ServiceName.annotation.serviceName).to.be.equal('foo-service');

        expect(records.Rpc).to.not.be.equal(undefined);
        expect(records.Rpc.annotation.name).to.be.equal('POST');

        expect(records.LocalAddr).to.be.not.equal(undefined);
        expect(records.ServerRecv).to.be.not.equal(undefined);
        expect(records.ServerSend).to.be.not.equal(undefined);

        expect(binaryRecords['http.path']).to.be.not.equal(undefined);
        expect(binaryRecords['http.path'].annotation.value).to.be.equal('/foo');

        expect(binaryRecords['http.status_code']).to.be.not.equal(undefined);
        expect(binaryRecords['http.status_code'].annotation.value).to.be.equal('201');

        const {traceId} = records.ServiceName;
        expect(traceId.traceId).to.be.equal('aaa-123');
        expect(traceId.spanId).to.be.equal(traceId.traceId);
        expect(traceId.parentId).to.be.equal(traceId.spanId);
        expect(traceId.sampled.getOrElse()).to.be.equal(true);
        expect(traceId.flags).to.be.equal(0);

        Object.keys(records).forEach((rec) => {
          expect(records[rec].traceId.traceId).to.be.equal(traceId.traceId);
          expect(records[rec].traceId.spanId).to.be.equal(traceId.spanId);
          expect(records[rec].traceId.parentId).to.be.equal(traceId.parentId);
          expect(records[rec].traceId.sampled.getOrElse()).to.be.equal(traceId.sampled.getOrElse());
        });
        done();
      }).catch(done);
    });
  });

  it('should record annotation for child span', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service', port: 3002}));
    app.use((ctx) => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const headers = {
        'X-B3-TraceId': 'aaa-123',
        'X-B3-SpanId': 'bbb-123',
        'X-B3-ParentSpanId': 'ccc-123',
        'X-B3-Sampled': '1'
      };
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post', headers}).then(() => {
        expect(records.ServiceName).to.be.not.equal(undefined);
        expect(records.Rpc).to.not.be.equal(undefined);

        expect(records.LocalAddr).to.be.not.equal(undefined);

        expect(records.ServerRecv).to.be.not.equal(undefined);
        expect(records.ServerSend).to.be.not.equal(undefined);

        expect(binaryRecords['http.path']).to.be.not.equal(undefined);
        expect(binaryRecords['http.status_code']).to.be.not.equal(undefined);

        const {traceId} = records.ServiceName;
        expect(traceId.traceId).to.be.equal('aaa-123');
        expect(traceId.spanId).to.be.equal('bbb-123');
        expect(traceId.parentId).to.be.equal('ccc-123');
        expect(traceId.sampled.getOrElse()).to.be.equal(true);
        expect(traceId.flags).to.be.equal(0);

        Object.keys(records).forEach((rec) => {
          expect(records[rec].traceId.traceId).to.be.equal(traceId.traceId);
          expect(records[rec].traceId.spanId).to.be.equal(traceId.spanId);
          expect(records[rec].traceId.parentId).to.be.equal(traceId.parentId);
          expect(records[rec].traceId.sampled.getOrElse()).to.be.equal(traceId.sampled.getOrElse());
        });
        done();
      }).catch(done);
    });
  });

  it('should create root span', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use((ctx) => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post'}).then(() => {
        const {traceId} = records.ServiceName;

        expect(traceId.traceId).to.have.lengthOf(16);
        expect(traceId.spanId).to.be.equal(traceId.traceId);
        expect(traceId.parentId).to.be.equal(traceId.spanId);
        expect(traceId.sampled.getOrElse()).to.be.equal(true);
        expect(traceId.flags).to.be.equal(0);
        done();
      }).catch(done);
    });
  });

  it('should set sampled=0', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use((ctx) => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const headers = {
        'X-B3-TraceId': 'aaa-123',
        'X-B3-SpanId': 'bbb-123',
        'X-B3-Sampled': '0'
      };
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post', headers}).then(() => {
        expect(records.ServiceName).to.be.equal(undefined);
        done();
      }).catch(done);
    });
  });

  it('should set flags=1 and sampled=1', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use((ctx) => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const headers = {
        'X-B3-TraceId': 'aaa-123',
        'X-B3-SpanId': 'bbb-123',
        'X-B3-Flags': '1'
      };
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post', headers}).then(() => {
        const {traceId} = records.ServiceName;

        expect(traceId.sampled.getOrElse()).to.be.equal(true);
        expect(traceId.flags).to.be.equal(1);
        done();
      }).catch(done);
    });
  });

  it('should set flags=1 and sampled=1 for created root span', (done) => {
    app.use(zipkinMiddleware({tracer, serviceName: 'foo-service'}));
    app.use((ctx) => {
      ctx.status = 201;
    });
    server = app.listen(0, () => {
      const headers = {
        'X-B3-Flags': '1'
      };
      fetch(`http://localhost:${server.address().port}/foo`, {method: 'post', headers}).then(() => {
        const {traceId} = records.ServiceName;

        expect(traceId.sampled.getOrElse()).to.be.equal(true);
        expect(traceId.flags).to.be.equal(1);
        done();
      }).catch(done);
    });
  });
});
