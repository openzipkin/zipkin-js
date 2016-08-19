const {Tracer, ExplicitContext, createNoopTracer} = require('zipkin');
const express = require('express');
const nodeRequest = require('request');
const sinon = require('sinon');
const wrapRequest = require('../src/wrapRequest');

describe('wrapRequest', () => {
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

  it('should add instrumentation to "request"', function(done) {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const request = wrapRequest(nodeRequest, {serviceName: 'user-service', tracer});

    ctxImpl.scoped(() => {
      const id = tracer.createChildId();
      tracer.setId(id);

      const path = `http://127.0.0.1:${this.port}/user`;
      request({
        uri: path,
        method: 'post'
      }, function (error, response, data) {
        const annotations = record.args.map(args => args[0]);

        // All annotations should have the same trace id and span id
        const traceId = annotations[0].traceId.traceId;
        const spanId = annotations[0].traceId.spanId;
        annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId));
        annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId));

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
        expect(annotations[0].annotation.serviceName).to.equal('user-service');

        expect(annotations[1].annotation.annotationType).to.equal('Rpc');
        expect(annotations[1].annotation.name).to.equal('POST');

        expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[2].annotation.key).to.equal('http.url');
        expect(annotations[2].annotation.value).to.equal(path);

        expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

        expect(annotations[4].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[4].annotation.key).to.equal('http.status_code');
        expect(annotations[4].annotation.value).to.equal('202');

        expect(annotations[5].annotation.annotationType).to.equal('ClientRecv');

        data = JSON.parse(data);
        const traceIdOnServer = data.traceId;
        expect(traceIdOnServer).to.equal(traceId);

        const spanIdOnServer = data.spanId;
        expect(spanIdOnServer).to.equal(spanId);

        done();
      });
    });
  });


  it('should not throw when using fetch without options', function(done) {
    const tracer = createNoopTracer();
    const request = wrapRequest(nodeRequest, {serviceName: 'user-service', tracer});

    const path = `http://127.0.0.1:${this.port}/user`;
    request({uri: path}, function () {
      done();
    });
  });
});
