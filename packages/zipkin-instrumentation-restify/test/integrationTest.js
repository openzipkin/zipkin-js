const sinon = require('sinon');
const {Tracer, ExplicitContext} = require('zipkin');
const fetch = require('node-fetch');
const restify = require('restify');
const middleware = require('../src/restifyMiddleware');

describe('restify middleware - integration test', () => {
  it('should receive trace info from the client', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = restify.createServer();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));
      app.post('/foo', (req, res, next) => {
        // Use setTimeout to test that the trace context is propagated into the callback
        const ctx = ctxImpl.getContext();
        setTimeout(() => {
          ctxImpl.letContext(ctx, () => {
            tracer.recordBinary('message', 'hello from within app');
            res.send(202, {status: 'OK'});
          });
        }, 10);
        return next();
      });
      const server = app.listen(0, () => {
        const port = server.address().port;
        const host = '127.0.0.1';
        const urlPath = '/foo';
        const url = `http://${host}:${port}${urlPath}`;
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

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

  it('should accept a 128bit X-B3-TraceId', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = restify.createServer();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));
      app.post('/foo', (req, res, next) => {
        // Use setTimeout to test that the trace context is propagated into the callback
        const ctx = ctxImpl.getContext();
        setTimeout(() => {
          ctxImpl.letContext(ctx, () => {
            tracer.recordBinary('message', 'hello from within app');
            res.send(202, {status: 'OK'});
          });
        }, 10);
        return next();
      });
      const server = app.listen(0, () => {
        const traceId = '863ac35c9f6413ad48485a3953bb6124';
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}/foo`;
        fetch(url, {
          method: 'post',
          headers: {
            'X-B3-TraceId': traceId,
            'X-B3-SpanId': '48485a3953bb6124',
            'X-B3-Flags': '1'
          }
        }).then(res => res.json()).then(() => {
          server.close();

          const annotations = record.args.map(args => args[0]);

          annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId));
          done();
        })
        .catch(err => {
          server.close();
          done(err);
        });
      });
    });
  });

  it('should record error on status <200 or >399', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    ctxImpl.scoped(() => {
      const app = restify.createServer();
      app.use(middleware({
        tracer,
        serviceName: 'service-a'
      }));
      app.post('/foo', (req, res, next) => {
        // Use setTimeout to test that the trace context is propagated into the callback
        const ctx = ctxImpl.getContext();
        setTimeout(() => {
          ctxImpl.letContext(ctx, () => {
            tracer.recordBinary('message', 'testing error annotation recording');
            res.send(404, {status: 'OK'});
          });
        }, 10);
        return next();
      });
      const server = app.listen(0, () => {
        const port = server.address().port;
        const host = '127.0.0.1';
        const urlPath = '/foo';
        const url = `http://${host}:${port}${urlPath}`;
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

          expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

          expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('message');
          expect(annotations[5].annotation.value).to.equal('testing error annotation recording');

          expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[6].annotation.key).to.equal('http.status_code');
          expect(annotations[6].annotation.value).to.equal('404');

          expect(annotations[7].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[7].annotation.key).to.equal('error');
          expect(annotations[7].annotation.value).to.equal('404');

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
});
