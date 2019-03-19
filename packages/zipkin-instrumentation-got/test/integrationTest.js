const {Tracer, ExplicitContext, createNoopTracer} = require('zipkin');
const express = require('express');
const baseGot = require('got');
const sinon = require('sinon');
const wrapGot = require('../src/wrapGot');

describe('wrapGot', () => {
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

  it('should add instrumentation to "got"', function(done) {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const got = wrapGot(baseGot, {
      tracer,
      serviceName: 'caller',
      remoteServiceName: 'callee'
    });

    ctxImpl.scoped(() => {
      const id = tracer.createChildId();
      tracer.setId(id);

      const host = '127.0.0.1';
      const urlPath = '/user';
      const url = `http://${host}:${this.port}${urlPath}`;
      got(url, {method: 'post', json: true})
        .then(res => res.body)
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

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

  it('should add a context property to the options', function(done) {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const requestSpy = sinon.spy();
    const got = wrapGot(baseGot, {
      tracer,
      serviceName: 'caller',
      remoteServiceName: 'callee'
    }).extend({
      hooks: {
        beforeRequest: [
          requestSpy
        ]
      }
    });

    ctxImpl.scoped(() => {
      const id = tracer.createChildId();
      tracer.setId(id);

      const host = '127.0.0.1';
      const urlPath = '/user';
      const url = `http://${host}:${this.port}${urlPath}`;
      got(url, {method: 'post', json: true})
        .then(() => {
          expect(requestSpy.calledOnce).to.be.true; // eslint-disable-line no-unused-expressions
          const firstArg = requestSpy.args[0][0];
          expect(firstArg).to.be.defined; // eslint-disable-line no-unused-expressions
          expect(firstArg._zipkin).to.not.be.undefined; // eslint-disable-line no-unused-expressions
          const {parentId, traceId} = firstArg._zipkin;
          expect(parentId).to.equal(id);
          expect(traceId).to.not.be.undefined; // eslint-disable-line no-unused-expressions
          expect(traceId.parentId).to.equal(id.traceId);
          done();
        })
        .catch(done);
    });
  });

  it('should not throw when using got without options', function(done) {
    const tracer = createNoopTracer();
    const got = wrapGot(baseGot, {serviceName: 'user-service', tracer});

    const path = `http://127.0.0.1:${this.port}/user`;
    got(path)
      .then(() => {
        done();
      })
      .catch(done);
  });

  it('should not throw when using got with a request object', function(done) {
    const tracer = createNoopTracer();
    const got = wrapGot(baseGot, {serviceName: 'user-service', tracer});

    const path = `http://127.0.0.1:${this.port}/user`;
    const request = {url: path};
    got(request)
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

    const got = wrapGot(baseGot, {
      tracer,
      serviceName: 'caller',
      remoteServiceName: 'callee'
    });

    ctxImpl.scoped(() => {
      const id = tracer.createChildId();
      tracer.setId(id);

      const host = 'domain.invalid';
      const url = `http://${host}`;
      got(url, {method: 'post', retry: 0})
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal('/');

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
