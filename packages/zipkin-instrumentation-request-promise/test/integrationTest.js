import uuid from 'uuid/v4';
import CLSContext from 'zipkin-context-cls';
import {Tracer} from 'zipkin';
import express from 'express';
import sinon from 'sinon';
import Request from '../src/request';

describe('request instrumentation - integration test', () => {
  const localServiceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let api;
  before(() => {
    api = express();
    api.get('/weather', (req, res) => {
      res.status(202).json({
        traceId: req.header('X-B3-TraceId'),
        spanId: req.header('X-B3-SpanId')
      });
    });
    api.get('/weather/securedTown', (req, res) => {
      res.status(400).json({
        traceId: req.header('X-B3-TraceId'),
        spanId: req.header('X-B3-SpanId')
      });
    });
    api.get('/weather/bagCity', (req, res) => {
      res.status(500).json({
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
    ctxImpl = new CLSContext(`zipkin-test-${uuid()}`);
    tracer = new Tracer({recorder, ctxImpl, localServiceName});
  });

  it('should add headers to requests', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

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
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest.get(url).then(() => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

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
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest.get({url}, () => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

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
  it('should support promise callback', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest.get({url}).then(() => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

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
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/doesNotExist';
        const url = `http://${apiHost}:${apiPort}${urlPath}`;
        zipkinRequest.get({url, timeout: 100}).catch(() => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('404');

          expect(annotations[6].annotation.key).to.equal('error');
          expect(annotations[6].annotation.value).to.equal('404');

          expect(annotations[7].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[8]).to.be.undefined; // eslint-disable-line no-unused-expressions

          done();
        });
      });
    });
  });


  it('should report when service does not exist', function(done) {
    this.timeout(1000); // Wait long than request timeout
    tracer.scoped(() => {
      api.listen(0, () => {
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const host = 'localhost:12345';
        const url = `http://${host}`;
        zipkinRequest.get({url, timeout: 200}).catch(() => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal('/');

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('error');
          expect(annotations[5].annotation.value)
            .to.contain('Error: connect ECONNREFUSED 127.0.0.1:12345');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[7]).to.be.undefined; // eslint-disable-line no-unused-expressions
          done();
        });
      });
    });
  });

  it('should report when service returns 400', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/weather/securedTown';
        const url = `http://${apiHost}:${apiPort}${urlPath}`;
        zipkinRequest.get({url, timeout: 100}).catch(() => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('400');

          expect(annotations[6].annotation.key).to.equal('error');
          expect(annotations[6].annotation.value).to.equal('400');

          expect(annotations[7].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[8]).to.be.undefined; // eslint-disable-line no-unused-expressions
          done();
        });
      });
    });
  });

  it('should report when service returns 500', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const zipkinRequest = new Request(tracer, remoteServiceName);
        const urlPath = '/weather/bagCity';
        const url = `http://${apiHost}:${apiPort}${urlPath}`;
        zipkinRequest.get({url, timeout: 100}).catch(() => {
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
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(urlPath);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('500');

          expect(annotations[6].annotation.key).to.equal('error');
          expect(annotations[6].annotation.value).to.equal('500');

          expect(annotations[7].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[8]).to.be.undefined; // eslint-disable-line no-unused-expressions
          done();
        });
      });
    });
  });
});
