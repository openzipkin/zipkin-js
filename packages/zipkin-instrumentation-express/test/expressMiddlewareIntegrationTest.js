const sinon = require('sinon');
const {Tracer, ExplicitContext} = require('zipkin');
const fetch = require('node-fetch');
const express = require('express');
const middleware = require('../src/expressMiddleware');

describe('express middleware - integration test', () => {
  it('should record request & response annotations', done => {
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
          method: 'post'
        }).then(res => res.json())
          .then(() => {
            server.close();

            const annotations = record.args.map(args => args[0]);
            const originalTraceId = annotations[0].traceId.traceId;
            const originalSpanId = annotations[0].traceId.spanId;

            annotations.forEach(ann => expect(ann.traceId.traceId)
              .to.have.lengthOf(16).and
              .to.equal(originalTraceId));
            annotations.forEach(ann => expect(ann.traceId.spanId)
              .to.have.lengthOf(16).and
              .to.equal(originalSpanId));

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
            expect(annotations[5].annotation.key).to.equal('message');
            expect(annotations[5].annotation.value).to.equal('hello from within app');

            expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
            expect(annotations[6].annotation.key).to.equal('http.status_code');
            expect(annotations[6].annotation.value).to.equal('202');

            expect(annotations[7].annotation.annotationType).to.equal('ServerSend');
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
        }).then(res => res.json())
          .then(() => {
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
});
