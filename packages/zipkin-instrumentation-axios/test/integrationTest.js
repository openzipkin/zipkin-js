import {Tracer, ExplicitContext} from 'zipkin';
import express from 'express';
import axios from 'axios';
import sinon from 'sinon';
import {expect} from 'chai';
import wrapAxios from '../src/index';

describe('axios instrumentation - integration test', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let apiServer;
  let apiHost;
  let apiPort;
  let record;
  let tracer;
  before((done) => {
    const api = express();
    api.get('/weather/wuhan', (req, res) => {
      res.status(202).json({
        traceId: req.header('X-B3-TraceId'),
        spanId: req.header('X-B3-SpanId')
      });
    });
    api.get('/weather/beijing', (req, res) => {
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
    apiServer = api.listen(0, () => {
      apiPort = apiServer.address().port;
      apiHost = '127.0.0.1';
      done();
    });
  });
  after(() => {
    apiServer.close();
  });
  const getClient = () => wrapAxios(axios, {tracer, serviceName, remoteServiceName});
  beforeEach(() => {
    record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    tracer = new Tracer({recorder, ctxImpl});
  });
  it('should add headers to requests', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/weather/wuhan';
      const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
      zipkinAxiosClient
          .get(url)
          .then(() => {
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
  it('should support request shorthand (defaults to GET)', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/weather/wuhan';
      const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
      zipkinAxiosClient.get(url).then(() => {
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
  it('should support both url and uri options', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/weather/wuhan';
      const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
      zipkinAxiosClient({url})
          .then(() => {
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
  it('should support promise callback', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/weather/wuhan';
      const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
      zipkinAxiosClient({url}).then(() => {
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

  it('should report 404 when path does not exist', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/doesNotExist';
      const url = `http://${apiHost}:${apiPort}${urlPath}`;
      zipkinAxiosClient({url, timeout: 100}).catch(() => {
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


  it('should report when service does not exist', function(done) {
    this.timeout(1000); // Wait long than request timeout
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const host = 'localhost:12345';
      const url = `http://${host}`;
      zipkinAxiosClient({url, timeout: 200}).catch(() => {
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

  it('should report when service returns 400', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/weather/securedTown';
      const url = `http://${apiHost}:${apiPort}${urlPath}`;
      zipkinAxiosClient({url, timeout: 100}).catch(() => {
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

  it('should report when service returns 500', done => {
    tracer.scoped(() => {
      const zipkinAxiosClient = getClient();
      const urlPath = '/weather/bagCity';
      const url = `http://${apiHost}:${apiPort}${urlPath}`;
      zipkinAxiosClient({url, timeout: 100}).catch(() => {
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

  it('should handle nested requests', done => {
    tracer.scoped(() => {
      const client = getClient();
      const getBeijingWeather = client.get(`http://${apiHost}:${apiPort}/weather/beijing`);
      const getWuhanWeather = client.get(`http://${apiHost}:${apiPort}/weather/wuhan`);

      getBeijingWeather.then(() => {
        getWuhanWeather.then(() => {
          const annotations = record.args.map(args => args[0]);
          let firstTraceId;
          let beijingWeatherSpanId;
          let beijingWeatherParentId;
          let wuhanWeatherSpanId;
          let wuhanWeatherParentId;

          annotations.forEach(annot => {
            if (firstTraceId) {
              expect(annot.traceId.traceId === firstTraceId);
            } else {
              firstTraceId = annot.traceId.traceId;
            }

            if (annot.annotation.value === '/weather/beijing') {
              beijingWeatherSpanId = annot.traceId.spanId;
              beijingWeatherParentId = annot.traceId.parentId;
            }
            if (annot.annotation.value === '/weather/wuhan') {
              wuhanWeatherSpanId = annot.traceId.spanId;
              wuhanWeatherParentId = annot.traceId.parentId;
            }

            expect(annot.traceId.spanId).to.equal(annot.traceId.parentId);
            expect(annot.traceId.parentId).to.equal(annot.traceId.spanId);
          });

          expect(beijingWeatherSpanId).to.not.equal(wuhanWeatherSpanId);
          expect(beijingWeatherParentId).to.not.equal(wuhanWeatherParentId);
          expect(beijingWeatherParentId).to.not.equal(wuhanWeatherSpanId);
          expect(wuhanWeatherSpanId).to.not.equal(beijingWeatherSpanId);
          expect(wuhanWeatherParentId).to.not.equal(beijingWeatherParentId);
          expect(wuhanWeatherParentId).to.not.equal(beijingWeatherSpanId);

          done();
        });
      });
    });
  });

  it('should handle parallel requests', () => {
    let promise;
    tracer.scoped(() => {
      const client = getClient();
      const getBeijingWeather = client.get(`http://${apiHost}:${apiPort}/weather/beijing`);
      const getWuhanWeather = client.get(`http://${apiHost}:${apiPort}/weather/wuhan`);
      promise = Promise.all([getBeijingWeather, getWuhanWeather]).then(() => {
        const annotations = record.args.map(args => args[0]);
        let firstTraceId;
        let beijingWeatherSpanId;
        let beijingWeatherParentId;
        let wuhanWeatherSpanId;
        let wuhanWeatherParentId;

        annotations.forEach(annot => {
          if (firstTraceId) {
            expect(annot.traceId.traceId === firstTraceId);
          } else {
            firstTraceId = annot.traceId.traceId;
          }

          if (annot.annotation.value === '/weather/beijing') {
            beijingWeatherSpanId = annot.traceId.spanId;
            beijingWeatherParentId = annot.traceId.parentId;
          }
          if (annot.annotation.value === '/weather/wuhan') {
            wuhanWeatherSpanId = annot.traceId.spanId;
            wuhanWeatherParentId = annot.traceId.parentId;
          }

          expect(annot.traceId.spanId).to.equal(annot.traceId.parentId);
          expect(annot.traceId.parentId).to.equal(annot.traceId.spanId);
        });

        expect(beijingWeatherSpanId).to.not.equal(wuhanWeatherSpanId);
        expect(beijingWeatherParentId).to.not.equal(wuhanWeatherParentId);
        expect(beijingWeatherParentId).to.not.equal(wuhanWeatherSpanId);
        expect(wuhanWeatherSpanId).to.not.equal(beijingWeatherSpanId);
        expect(wuhanWeatherParentId).to.not.equal(beijingWeatherParentId);
        expect(wuhanWeatherParentId).to.not.equal(beijingWeatherSpanId);
      });
    });
    return promise;
  });
});
