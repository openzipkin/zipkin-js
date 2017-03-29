const {Tracer, ExplicitContext} = require('zipkin');
const express = require('express');
const request = require('request');
const sinon = require('sinon');
const wrapRequest = require('../src/wrapRequest');

describe('request instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let api;
  before(() => {
    api = express();
    api.use('/weather', (req, res) => {
      res.status(202).json({
        traceId: req.header('X-B3-TraceId'),
        spanId: req.header('X-B3-SpanId')
      });
    });
  });

  let record;
  let recorder;
  let ctxImpl;
  let tracer;
  beforeEach(() => {
    record = sinon.spy();
    recorder = {record};
    ctxImpl = new ExplicitContext();
    tracer = new Tracer({recorder, ctxImpl});
  });

  it('should add headers to requests', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = `http://127.0.0.1:${apiPort}/weather?index=10&count=300`;
        zipkinRequest.get(url, () => {
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
  it('should support request shorthand (defaults to GET)', done => {
    tracer.scoped(() => {
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
  it('should support both url and uri options', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = `http://127.0.0.1:${apiPort}/weather?index=10&count=300`;
        zipkinRequest({url}, () => {
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
  it('should support callback as an options', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = `http://127.0.0.1:${apiPort}/weather?index=10&count=300`;
        zipkinRequest({
          url, callback: () => {
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
          }
        });
      });
    });
  });
  it('should support on response event', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = `http://127.0.0.1:${apiPort}/weather?index=10&count=300`;
        zipkinRequest({url}).on('response', () => {
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

  it('should report 404 when path does not exist', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = `http://127.0.0.1:${apiPort}/doesNotExist`;
        zipkinRequest({url, timeout: 100}).on('response', () => {
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
          expect(annotations[5].annotation.value).to.equal('404');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[7]).to.be.undefined; // eslint-disable-line no-unused-expressions

          done();
        });
      });
    });
  });


  it('should report request.error when service does not exist', done => {
    tracer.scoped(() => {
      api.listen(0, () => {
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const url = 'http://bad.invalid.url';
        zipkinRequest({url, timeout: 100}).on('error', () => {
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
          expect(annotations[5].annotation.key).to.equal('error');
          expect(annotations[5].annotation.value)
            .to.contain('Error: getaddrinfo ENOTFOUND bad.invalid.url bad.invalid.url:80');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[7]).to.be.undefined; // eslint-disable-line no-unused-expressions
          done();
        });
      });
    });
  });
});
