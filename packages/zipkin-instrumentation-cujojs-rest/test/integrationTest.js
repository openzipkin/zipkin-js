const {Tracer, ExplicitContext} = require('zipkin');
const express = require('express');
const sinon = require('sinon');
const rest = require('rest');
const restInterceptor = require('../src/restInterceptor');

describe('cujojs rest interceptor - integration test', () => {
  it('should add headers to requests', done => {
    const app = express();
    app.get('/abc', (req, res) => {
      res.status(202).json({
        traceId: req.header('X-B3-TraceId'),
        spanId: req.header('X-B3-SpanId')
      });
    });

    const server = app.listen(0, () => {
      const record = sinon.spy();
      const recorder = {record};
      const ctxImpl = new ExplicitContext();
      const tracer = new Tracer({recorder, ctxImpl});

      tracer.scoped(() => {
        const client = rest.wrap(restInterceptor, {
          tracer,
          serviceName: 'caller',
          remoteServiceName: 'callee'
        });
        const port = server.address().port;
        const path = `http://127.0.0.1:${port}/abc`;
        client(path).then(successResponse => {
          const responseData = JSON.parse(successResponse.entity);
          server.close();

          const annotations = record.args.map(args => args[0]);

          // All annotations should have the same trace id and span id
          const traceId = annotations[0].traceId.traceId;
          const spanId = annotations[0].traceId.spanId;
          annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId));
          annotations.forEach(ann => expect(ann.traceId.spanId).to.equal(spanId));

          expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
          expect(annotations[0].annotation.serviceName).to.equal('caller');

          expect(annotations[1].annotation.annotationType).to.equal('Rpc');
          expect(annotations[1].annotation.name).to.equal('GET');

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

          const traceIdOnServer = responseData.traceId;
          expect(traceIdOnServer).to.equal(traceId);

          const spanIdOnServer = responseData.spanId;
          expect(spanIdOnServer).to.equal(spanId);

          done();
        }, errorResponse => {
          if (errorResponse instanceof Error) {
            done(errorResponse);
          } else {
            server.close();
            done(new Error(`The request failed: ${errorResponse.error.toString()}`));
          }
        });
      });
    });
  });
});
