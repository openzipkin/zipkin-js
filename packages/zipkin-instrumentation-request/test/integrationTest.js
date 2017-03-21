const {Tracer, ExplicitContext} = require('zipkin');
const express = require('express');
const request = require('request');
const sinon = require('sinon');
const wrapRequest = require('../src/wrapRequest');

describe('request instrumentation - integration test', () => {
  const api = express();
  api.use('/weather', (req, res) => {
    res.status(202).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });

  it('should add headers to requests', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    tracer.scoped(() => {
      const serviceName = 'weather-app';
      const remoteServiceName = 'weather-api';

      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = `http://127.0.0.1:${apiPort}/weather?index=10&count=300`;
        zipkinRequest(url, () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = annotations[0].traceId.traceId;
          annotations.forEach(ann => expect(ann.traceId.traceId)
            .to.equal(initialTraceId).and
            .to.have.lengthOf(16));

          expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
          expect(annotations[0].annotation.serviceName).to.equal('weather-app');

          expect(annotations[1].annotation.annotationType).to.equal('Rpc');
          expect(annotations[1].annotation.name).to.equal('GET');

          expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[2].annotation.key).to.equal('http.url');
          expect(annotations[2].annotation.value).to.equal(url);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('202');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');
          done();
        });
      });
    });
  });
});
