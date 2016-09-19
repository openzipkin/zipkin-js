const sinon = require('sinon');
const {Tracer, ExplicitContext} = require('zipkin');
const fetch = require('node-fetch');
const express = require('express');
const middleware = require('../src/expressMiddleware');

describe('express middleware - integration test', () => {
  it.skip('should create traceId', () => {});
  it('should receive trace info from the client', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = express();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));
      app.post('/foo', (req, res) => {
        // Use setTimeout to test that the trace context is propagated into the callback
        const ctx = ctxImpl.getContext();
        setTimeout(() => {
          ctxImpl.letContext(ctx, () => {
            tracer.recordBinary('message', 'hello from within app');
            res.status(202).json({status: 'OK'});
          });
        }, 10);
      });
      const server = app.listen(0, () => {
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}/foo`;
        fetch(url, {
          method: 'post',
          headers: {
            'X-B3-TraceId': 'aaa',
            'X-B3-SpanId': 'bbb',
            'X-B3-Flags': '1'
          }
        }).then(res => res.json()).then(() => {
          server.close();

          const annotations = record.args.map(args => args[0]);

          annotations.forEach(ann => expect(ann.traceId.traceId).to.equal('aaa'));
          annotations.forEach(ann => expect(ann.traceId.spanId).to.equal('bbb'));

          expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
          expect(annotations[0].annotation.serviceName).to.equal('service-a');

          expect(annotations[1].annotation.annotationType).to.equal('Rpc');
          expect(annotations[1].annotation.name).to.equal('POST');

          expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[2].annotation.key).to.equal('http.url');
          expect(annotations[2].annotation.value).to.equal(url);

          expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

          expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('X-B3-Flags');
          expect(annotations[5].annotation.value).to.equal('1');

          expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[6].annotation.key).to.equal('message');
          expect(annotations[6].annotation.value).to.equal('hello from within app');

          expect(annotations[7].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[7].annotation.key).to.equal('http.status_code');
          expect(annotations[7].annotation.value).to.equal('202');

          expect(annotations[8].annotation.annotationType).to.equal('ServerSend');
          done();
        })
        .catch(err => {
          server.close();
          done(err);
        });
      });
    });
  });

  it('should properly report the URL with a query string', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = express();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));
      app.get('/foo', (req, res) => {
        // Use setTimeout to test that the trace context is propagated into the callback
        const ctx = ctxImpl.getContext();
        setTimeout(() => {
          ctxImpl.letContext(ctx, () => {
            tracer.recordBinary('message', 'hello from within app');
            res.status(202).json({status: 'OK'});
          });
        }, 10);
      });
      const server = app.listen(0, () => {
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}/foo?abc=123`;
        fetch(url, {
          method: 'get'
        }).then(res => res.json()).then(() => {
          server.close();

          const annotations = record.args.map(args => args[0]);

          expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[2].annotation.key).to.equal('http.url');
          expect(annotations[2].annotation.value).to.equal(url);
          done();
        })
        .catch(err => {
          server.close();
          done(err);
        });
      });
    });
  });

  // Once zipkin supports it, we can add a flag to propagate and report 128-bit
  // trace identifiers. Until then, tolerantly read them.
  // https://github.com/openzipkin/zipkin/issues/1298
  it('should drop high bits of a 128bit X-B3-TraceId', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = express();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));
      app.post('/foo', (req, res) => {
        // Use setTimeout to test that the trace context is propagated into the callback
        const ctx = ctxImpl.getContext();
        setTimeout(() => {
          ctxImpl.letContext(ctx, () => {
            tracer.recordBinary('message', 'hello from within app');
            res.status(202).json({status: 'OK'});
          });
        }, 10);
      });
      const server = app.listen(0, () => {
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}/foo`;
        fetch(url, {
          method: 'post',
          headers: {
            'X-B3-TraceId': '863ac35c9f6413ad48485a3953bb6124',
            'X-B3-SpanId': '48485a3953bb6124',
            'X-B3-Flags': '1'
          }
        }).then(res => res.json()).then(() => {
          server.close();

          const annotations = record.args.map(args => args[0]);

          annotations.forEach(ann => expect(ann.traceId.traceId).to.equal('48485a3953bb6124'));
          done();
        })
        .catch(err => {
          server.close();
          done(err);
        });
      });
    });
  });
});
