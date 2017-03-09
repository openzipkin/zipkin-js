const {Tracer, ExplicitContext} = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const express = require('express');
const proxy = require('express-http-proxy');
const fetch = require('node-fetch');
const sinon = require('sinon');
const wrapProxy = require('../src/wrapExpressHttpProxy');
const middleware = require('../src/expressMiddleware');

describe('express http proxy instrumentation - integration test', () => {
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
        const app = express();
        const apiPort = apiServer.address().port;

        const zipkinProxy = wrapProxy(proxy, {tracer, serviceName, remoteServiceName});

        app.use(zipkinProxy(`127.0.0.1:${apiPort}`, {
          decorateRequest: (proxyReq) => {
            const modifiedReq = proxyReq;
            modifiedReq.method = 'POST';
            return modifiedReq;
          },
          intercept: (rsp, data, originalReq, res, callback) => {
            const modifiedServiceResponse = rsp;
            modifiedServiceResponse.statusCode = 203;
            callback(null, data);
          }
        }));

        const appServer = app.listen(0, () => {
          const appPort = appServer.address().port;
          const url = `http://127.0.0.1:${appPort}/weather?index=10&count=300`;
          fetch(url)
            .then(res => res.json())
            .then(() => {
              appServer.close();

              const annotations = record.args.map(args => args[0]);
              const initialTraceId = annotations[0].traceId.traceId;
              annotations.forEach(ann =>
                expect(ann.traceId.traceId)
                  .to.equal(initialTraceId).and
                  .to.have.lengthOf(16));

              expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
              expect(annotations[0].annotation.serviceName).to.equal('weather-app');

              expect(annotations[1].annotation.annotationType).to.equal('Rpc');
              expect(annotations[1].annotation.name).to.equal('POST');

              expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[2].annotation.key).to.equal('http.url');
              // express-http-proxy does not include protocol when intercepting request
              const apiUrlWithoutProtocol = `//127.0.0.1:${apiPort}/weather?index=10&count=300`;
              expect(annotations[2].annotation.value).to.equal(apiUrlWithoutProtocol);

              expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

              expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

              expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[5].annotation.key).to.equal('http.status_code');
              expect(annotations[5].annotation.value).to.equal('203');

              expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');
              done();
            })
            .catch(err => {
              appServer.close();
              done(err);
            });
        });
      });
    });
  });

  it('should create decorateRequest and intercept functions if they do not exist', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    tracer.scoped(() => {
      const serviceName = 'weather-app';
      const remoteServiceName = 'weather-api';

      const apiServer = api.listen(0, () => {
        const app = express();
        const apiPort = apiServer.address().port;

        const zipkinProxy = wrapProxy(proxy, {tracer, serviceName, remoteServiceName});

        app.use(zipkinProxy(`127.0.0.1:${apiPort}`));

        const appServer = app.listen(0, () => {
          const appPort = appServer.address().port;
          const url = `http://127.0.0.1:${appPort}/weather?index=10&count=300`;
          fetch(url)
            .then(res => res.json())
            .then(() => {
              appServer.close();

              const annotations = record.args.map(args => args[0]);
              const initialTraceId = annotations[0].traceId.traceId;
              annotations.forEach(ann =>
                expect(ann.traceId.traceId)
                  .to.equal(initialTraceId).and
                  .to.have.lengthOf(16));

              expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
              expect(annotations[0].annotation.serviceName).to.equal('weather-app');

              expect(annotations[1].annotation.annotationType).to.equal('Rpc');
              expect(annotations[1].annotation.name).to.equal('GET');

              expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[2].annotation.key).to.equal('http.url');
              // express-http-proxy does not include protocol when intercepting request
              const apiUrlWithoutProtocol = `//127.0.0.1:${apiPort}/weather?index=10&count=300`;
              expect(annotations[2].annotation.value).to.equal(apiUrlWithoutProtocol);

              expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

              expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

              expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[5].annotation.key).to.equal('http.status_code');
              expect(annotations[5].annotation.value).to.equal('202');

              expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');
              done();
            })
            .catch(err => {
              appServer.close();
              done(err);
            });
        });
      });
    });
  });

  it('should work in conjunction with express middleware and zipkin-context-cls', done => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new CLSContext();
    const tracer = new Tracer({recorder, ctxImpl});

    tracer.scoped(() => {
      const serviceName = 'weather-app';
      const remoteServiceName = 'weather-api';

      const apiServer = api.listen(0, () => {
        const app = express();
        const apiPort = apiServer.address().port;

        const zipkinProxy = wrapProxy(proxy, {tracer, serviceName, remoteServiceName});

        app.use(middleware({tracer, serviceName}), zipkinProxy(`127.0.0.1:${apiPort}`, {
          decorateRequest: (proxyReq) => {
            const modifiedReq = proxyReq;
            modifiedReq.method = 'POST';
            return modifiedReq;
          },
          intercept: (rsp, data, originalReq, res, callback) => {
            const modifiedClientResponse = res;
            modifiedClientResponse.statusCode = 203;
            callback(null, data);
          }
        }));

        const appServer = app.listen(0, () => {
          const appPort = appServer.address().port;
          const url = `http://127.0.0.1:${appPort}/weather?index=10&count=300`;
          fetch(url, {
            method: 'put',
            headers: {
              'X-B3-TraceId': 'aaa',
              'X-B3-SpanId': 'bbb',
              'X-B3-Flags': '1'
            }
          }).then(res => res.json())
            .then(() => {
              appServer.close();

              const annotations = record.args.map(args => args[0]);

              annotations.forEach(ann => expect(ann.traceId.traceId).to.equal('aaa'));
              expect(annotations.map(ann => ann.traceId.spanId)).to.contain('bbb');

              expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
              expect(annotations[0].annotation.serviceName).to.equal('weather-app');

              expect(annotations[1].annotation.annotationType).to.equal('Rpc');
              expect(annotations[1].annotation.name).to.equal('PUT');

              expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[2].annotation.key).to.equal('http.url');
              expect(annotations[2].annotation.value).to.equal(url);

              expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

              expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

              expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[5].annotation.key).to.equal('X-B3-Flags');
              expect(annotations[5].annotation.value).to.equal('1');

              expect(annotations[6].annotation.annotationType).to.equal('ServiceName');
              expect(annotations[6].annotation.serviceName).to.equal('weather-app');

              expect(annotations[7].annotation.annotationType).to.equal('Rpc');
              expect(annotations[7].annotation.name).to.equal('POST');

              expect(annotations[8].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[8].annotation.key).to.equal('http.url');
              // express-http-proxy does not include protocol when intercepting request
              const apiUrlWithoutProtocol = `//127.0.0.1:${apiPort}/weather?index=10&count=300`;
              expect(annotations[8].annotation.value).to.equal(apiUrlWithoutProtocol);

              expect(annotations[9].annotation.annotationType).to.equal('ClientSend');

              expect(annotations[10].annotation.annotationType).to.equal('ServerAddr');

              expect(annotations[11].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[11].annotation.key).to.equal('http.status_code');
              expect(annotations[11].annotation.value).to.equal('202');

              expect(annotations[12].annotation.annotationType).to.equal('ClientRecv');

              expect(annotations[13].annotation.annotationType).to.equal('BinaryAnnotation');
              expect(annotations[13].annotation.key).to.equal('http.status_code');
              expect(annotations[13].annotation.value).to.equal('203');

              expect(annotations[14].annotation.annotationType).to.equal('ServerSend');

              done();
            })
            .catch(err => {
              appServer.close();
              done(err);
            });
        });
      });
    });
  });
});
