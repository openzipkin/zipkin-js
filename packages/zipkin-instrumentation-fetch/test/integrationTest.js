const {Tracer, ExplicitContext, createNoopTracer} = require('zipkin');
const express = require('express');
const nodeFetch = require('node-fetch');
const sinon = require('sinon');
const wrapFetch = require('../src/wrapFetch');

describe('wrapFetch', () => {
  before(function(done) {
    const app = express();
    app.post('/user', (req, res) => res.status(202).json({
      traceId: req.header('X-B3-TraceId') || '?',
      spanId: req.header('X-B3-SpanId') || '?'
    }));
    app.get('/user', (req, res) => res.status(202).json({}));
    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      done();
    });
  });

  after(function(done) {
    this.server.close(done);
  });

  it('should add instrumentation to "fetch"', function(done) {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const fetch = wrapFetch(nodeFetch, {
      tracer,
      serviceName: 'caller',
      remoteServiceName: 'callee'
    });

    ctxImpl.scoped(() => {
      const id = tracer.createChildId();
      tracer.setId(id);

      const path = `http://127.0.0.1:${this.port}/user`;
      fetch(path, {method: 'post'})
        .then(res => res.json())
        .then(data => {
          const annotations = record.args.map(args => args[0]);

          // All annotations should have the same trace id and span id
          const traceId = annotations[0].traceId.traceId;
          const spanId = annotations[0].traceId.spanId;
          annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId));
          annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId));

          expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
          expect(annotations[0].annotation.serviceName).to.equal('caller');

          expect(annotations[1].annotation.annotationType).to.equal('Rpc');
          expect(annotations[1].annotation.name).to.equal('POST');

          expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[2].annotation.key).to.equal('http.url');
          expect(annotations[2].annotation.value).to.equal(path);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');
          expect(annotations[4].annotation.serviceName).to.equal('callee');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('202');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          const traceIdOnServer = data.traceId;
          expect(traceIdOnServer).to.equal(traceId);

          const spanIdOnServer = data.spanId;
          expect(spanIdOnServer).to.equal(spanId);
        })
        .then(done)
        .catch(done);
    });
  });


  it('should not throw when using fetch without options', function(done) {
    const tracer = createNoopTracer();
    const fetch = wrapFetch(nodeFetch, {serviceName: 'user-service', tracer});

    const path = `http://127.0.0.1:${this.port}/user`;
    fetch(path)
      .then(res => res.json())
      .then(() => {
        done();
      })
      .catch(done);
  });

  it('should record error', (done) => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const fetch = wrapFetch(nodeFetch, {
      tracer,
      serviceName: 'caller',
      remoteServiceName: 'callee'
    });

    ctxImpl.scoped(() => {
      const id = tracer.createChildId();
      tracer.setId(id);

      const path = 'http://domain.invalid';
      fetch(path, {method: 'post'})
        .then(() => expect.fail())
        .catch(() => {
          const annotations = record.args.map(args => args[0]);

          // All annotations should have the same trace id and span id
          const traceId = annotations[0].traceId.traceId;
          const spanId = annotations[0].traceId.spanId;
          annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId));
          annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId));

          expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
          expect(annotations[0].annotation.serviceName).to.equal('caller');

          expect(annotations[1].annotation.annotationType).to.equal('Rpc');
          expect(annotations[1].annotation.name).to.equal('POST');

          expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[2].annotation.key).to.equal('http.url');
          expect(annotations[2].annotation.value).to.equal(path);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');
          expect(annotations[4].annotation.serviceName).to.equal('callee');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('error');
          expect(annotations[5].annotation.value)
            .to.contain('getaddrinfo ENOTFOUND domain.invalid');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[7]).to.be.undefined; // eslint-disable-line no-unused-expressions
          done();
        });
    });
  });
});
