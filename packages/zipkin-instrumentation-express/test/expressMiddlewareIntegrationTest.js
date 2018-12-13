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
        const host = '127.0.0.1';
        const urlPath = '/foo';
        const url = `http://${host}:${port}${urlPath}`;
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
            expect(annotations[2].annotation.key).to.equal('http.path');
            expect(annotations[2].annotation.value).to.equal(urlPath);

            expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

            expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

            expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
            expect(annotations[5].annotation.key).to.equal('message');
            expect(annotations[5].annotation.value).to.equal('hello from within app');

            expect(annotations[6].annotation.annotationType).to.equal('Rpc');
            expect(annotations[6].annotation.name).to.equal('POST /foo');

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
        const host = '127.0.0.1';
        const urlPath = '/foo';
        const url = `http://${host}:${port}${urlPath}?abc=123`;
        fetch(url, {
          method: 'get'
        }).then(res => res.json())
          .then(() => {
            server.close();

            const annotations = record.args.map(args => args[0]);

            expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
            expect(annotations[2].annotation.key).to.equal('http.path');
            expect(annotations[2].annotation.value).to.equal(urlPath);

            done();
          })
          .catch(err => {
            server.close();
            done(err);
          });
      });
    });
  });

  it('should report Rpc with route path', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = express();
      app.use(middleware({tracer, serviceName: 'service-a'}));

      app.get('/foo/:id', (req, res) => {
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
        const host = '127.0.0.1';
        const urlPath = '/foo/123';
        const url = `http://${host}:${port}${urlPath}`;
        fetch(url, {
          method: 'get'
        }).then(res => res.json())
          .then(() => {
            server.close();

            const annotations = record.args.map(args => args[0]);

            expect(annotations[6].annotation.annotationType).to.equal('Rpc');
            expect(annotations[6].annotation.name).to.equal('GET /foo/:id');

            done();
          })
          .catch(err => {
            server.close();
            done(err);
          });
      });
    });
  });

  it('should have the same traceId in async calls on same request', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    function step(num) {
      return new Promise((resolve) => {
        setTimeout(() => {
          tracer.scoped(() => {
            tracer.recordBinary('step', num);
            resolve();
          });
        }, 10);
      });
    }

    ctxImpl.scoped(() => {
      const app = express();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));

      app.get('/foo', (req, res) => step(1)
          .then(() => step(2))
          .then(() => step(3))
          .then(() => res.status(202).json({status: 'OK'})));

      const server = app.listen(0, () => {
        const port = server.address().port;
        const host = '127.0.0.1';
        const urlPath = '/foo';
        const url = `http://${host}:${port}${urlPath}?abc=123`;

        fetch(url)
          .then(res => res.json())
          .then(() => {
            const annotations = record.args.map(args => args[0]);
            const originalTraceId = annotations[0].traceId.traceId;
            const originalSpanId = annotations[0].traceId.spanId;

            annotations.forEach(ann =>
              expect(ann.traceId.traceId)
                .to.have.lengthOf(16).and
                .to.equal(originalTraceId));

            annotations.forEach(ann =>
              expect(ann.traceId.spanId)
                .to.have.lengthOf(16).and
                .to.equal(originalSpanId));

            record.reset();

            fetch(url)
              .then(res => res.json())
              .then(() => {
                server.close();

                const annot2 = record.args.map(args => args[0]);
                const traceId2 = annot2[0].traceId.traceId;
                const spanId2 = annot2[0].traceId.spanId;

                annot2.forEach(ann =>
                  expect(ann.traceId.traceId)
                    .to.have.lengthOf(16).and
                    .to.equal(traceId2));

                annot2.forEach(ann =>
                  expect(ann.traceId.spanId)
                    .to.have.lengthOf(16).and
                    .to.equal(spanId2));

                expect(originalTraceId).to.not.equal(traceId2);
                done();
              });
          })
          .catch(err => {
            server.close();
            done(err);
          });
      });
    });
  });

  it('should mark 500 respones as errors', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = express();
      app.use(middleware({tracer, serviceName: 'service-a'}));

      app.get('/error', (req, res) => {
        tracer.recordBinary('message', 'hello from within app');
        res.status(500).send({status: 'An Error Occurred'});
      });

      const server = app.listen(0, () => {
        const port = server.address().port;
        const urlPath = `http://127.0.0.1:${port}/error`;

        fetch(urlPath, {
          method: 'get'
        }).then(res => {
          server.close();

          expect(res.status).to.equal(500);

          const annotations = record.args.map(args => args[0]);

          expect(annotations[7].annotation.key).to.equal('http.status_code');
          expect(annotations[7].annotation.value).to.equal('500');
          expect(annotations[8].annotation.key).to.equal('error');
          expect(annotations[8].annotation.value).to.equal('500');

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
