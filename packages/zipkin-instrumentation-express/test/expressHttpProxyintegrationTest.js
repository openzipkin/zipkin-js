const {Tracer, ExplicitContext} = require('zipkin');
const express = require('express');
const proxy = require('express-http-proxy');
const fetch = require('node-fetch');
const sinon = require('sinon');
const ProxyInstrumentation = require('../src/expressHttpProxyInstrumentation');

describe('express http proxy instrumentation - integration test', () => {
  it('should add headers to requests', done => {
    const api = express();
    api.use('/weather', (req, res) => {
      res.status(202).json({
        traceId: req.header('X-B3-TraceId'),
        spanId: req.header('X-B3-SpanId')
      });
    });

    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    tracer.scoped(() => {
      const nameOfApp = 'weather-app';
      const nameOfRemoteService = 'weather-api';
      const instrumentation = new ProxyInstrumentation(tracer, nameOfApp, nameOfRemoteService);

      const apiServer = api.listen(0, () => {
        const app = express();
        const apiPort = apiServer.address().port;
        app.use(proxy(`127.0.0.1:${apiPort}`, {
          decorateRequest: (proxyReq, originalReq) =>
            instrumentation.decorateAndRecordRequest(proxyReq, originalReq),
          intercept: (rsp, data, originalReq, res, callback) => {
            instrumentation.recordResponse(rsp, originalReq);
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
});
