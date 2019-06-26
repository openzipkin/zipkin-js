import {promisify} from 'util';

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
      setTimeout(() => {
        res.status(202).json({
          traceId: req.header('X-B3-TraceId'),
          spanId: req.header('X-B3-SpanId')
        });
      }, req.query.delay || 0); // optionally delay the response for some time
    });
  });

  let record;
  let recorder;
  let ctxImpl;
  let tracer;
  let rootId;
  beforeEach(() => {
    record = sinon.spy();
    recorder = {record};
    ctxImpl = new ExplicitContext();
    tracer = new Tracer({recorder, ctxImpl});
    rootId = tracer.createRootId();
    tracer.setId(rootId);
  });

  it('should add headers to requests', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest.get(url, () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = rootId.traceId;
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

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
            'Current span should\'ve been restored to the original parent');

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
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest(url, () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = rootId.traceId;
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

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
            'Current span should\'ve been restored to the original parent');

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
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest({url}, () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = rootId.traceId;
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

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
            'Current span should\'ve been restored to the original parent');

          done();
        });
      });
    });
  });
  it('should support callback as an options', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest({
          url, callback: () => {
            const annotations = record.args.map(args => args[0]);
            const initialTraceId = rootId.traceId;
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

            const currentSpan = tracer.id.spanId;
            expect(currentSpan).to.equal(rootId.spanId,
              'Current span should\'ve been restored to the original parent');

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
        const apiHost = '127.0.0.1';
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;
        zipkinRequest({url}).on('response', () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = rootId.traceId;
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

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
              'Current span should\'ve been restored to the original parent');

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
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const urlPath = '/doesNotExist';
        const url = `http://${apiHost}:${apiPort}${urlPath}`;
        zipkinRequest({url, timeout: 100}).on('response', () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = rootId.traceId;
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

          expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[6].annotation.key).to.equal('error');
          expect(annotations[6].annotation.value).to.equal('404');

          expect(annotations[7].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[8]).to.be.undefined; // eslint-disable-line no-unused-expressions

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
              'Current span should\'ve been restored to the original parent');

          done();
        });
      });
    });
  });


  it('should report request.error when service does not exist', done => {
    tracer.scoped(() => {
      api.listen(0, () => {
        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});
        const host = 'bad.invalid.url';
        const url = `http://${host}`;
        zipkinRequest({url, timeout: 5000}).on('error', () => {
          const annotations = record.args.map(args => args[0]);
          const initialTraceId = rootId.traceId;
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
            .to.contain('Error: getaddrinfo ENOTFOUND bad.invalid.url bad.invalid.url:80');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          expect(annotations[7]).to.be.undefined; // eslint-disable-line no-unused-expressions

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
              'Current span should\'ve been restored to the original parent');

          done();
        });
      });
    });
  });

  /**
   *  trace ----------
   *  req 1   ------
   *  req 2   ------
   */
  it('should record the correct ids for parallel requests', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300&delay=10`;

        const wrapped = promisify(wrapRequest(request, {tracer, serviceName, remoteServiceName}));

        const promise1 = wrapped(url);
        const promise2 = wrapped(url);

        return Promise.all([promise1, promise2]).then(() => {
          const annotations = record.args.map(args => args[0]);

          annotations.forEach(ann => expect(ann.traceId.traceId)
            .to.equal(rootId.traceId).and
            .to.have.lengthOf(16));

          const spans = new Set(annotations.map(a => a.traceId.spanId));
          expect(spans).to.have.property('size', 2);

          annotations.forEach(ann => expect(ann.traceId.spanId)
            .to.not.equal(rootId.traceId, 'the span id should not equal the root id'));

          annotations.forEach(ann => expect(ann.traceId.parentId.getOrElse())
            .to.have.lengthOf(16).and
            .to.equal(rootId.traceId, 'all spans should have the root as their parent'));

          const currentSpan = tracer.id.spanId;
          expect(currentSpan).to.equal(rootId.spanId,
              'Current span should\'ve been restored to the original parent');

          done();
        });
      });
    });
  });

  /**
   *  trace ---------------
   *  req 1   ----
   *  req 2          ----
   */
  it('should record the correct ids for sequential requests', done => {
    tracer.scoped(() => {
      const apiServer = api.listen(0, () => {
        const apiPort = apiServer.address().port;
        const apiHost = '127.0.0.1';
        const urlPath = '/weather';
        const url = `http://${apiHost}:${apiPort}${urlPath}?index=10&count=300`;

        const urlpathDoesNotExist = '/doesNotExist';
        const urlDoesNotExist = `http://${apiHost}:${apiPort}${urlpathDoesNotExist}?index=10&count=300`;

        const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});

        zipkinRequest.get(url, () => {
          zipkinRequest.get(urlDoesNotExist, () => {
            const annotations = record.args.map(args => args[0]);

            annotations.forEach(ann => expect(ann.traceId.traceId)
              .to.equal(rootId.traceId).and
              .to.have.lengthOf(16));

            const spans = new Set(annotations.map(a => a.traceId.spanId));
            expect(spans).to.have.property('size', 2);

            annotations.forEach(ann => expect(ann.traceId.spanId)
              .to.have.lengthOf(16).and
              .to.not.equal(rootId.traceId));

            annotations.forEach(ann => expect(ann.traceId.parentId.getOrElse())
              .to.have.lengthOf(16).and
              .to.equal(rootId.traceId, 'all spans should have the root as their parent'));

            // request 1
            const spanId1 = annotations[0].traceId.spanId;
            annotations.slice(0, 6).forEach(ann => expect(ann.traceId.spanId)
              .to.have.lengthOf(16).and
              .to.equal(spanId1, 'all annotations for span1 should have the same span id'));

            expect(annotations[0].traceId.spanId).to.equal(spanId1);

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

            // request 2
            const spanId2 = annotations[7].traceId.spanId;
            annotations.slice(7).forEach(ann => expect(ann.traceId.spanId)
              .to.have.lengthOf(16).and
              .to.equal(spanId2, 'all annotations for span2 should have the same span id'));

            expect(annotations[7].annotation.annotationType).to.equal('ServiceName');
            expect(annotations[7].annotation.serviceName).to.equal('weather-app');

            expect(annotations[8].annotation.annotationType).to.equal('Rpc');
            expect(annotations[8].annotation.name).to.equal('GET');

            expect(annotations[9].annotation.annotationType).to.equal('BinaryAnnotation');
            expect(annotations[9].annotation.key).to.equal('http.path');
            expect(annotations[9].annotation.value).to.equal(urlpathDoesNotExist);

            expect(annotations[10].annotation.annotationType).to.equal('ClientSend');

            expect(annotations[11].annotation.annotationType).to.equal('ServerAddr');

            expect(annotations[12].annotation.annotationType).to.equal('BinaryAnnotation');
            expect(annotations[12].annotation.key).to.equal('http.status_code');
            expect(annotations[12].annotation.value).to.equal('404');

            expect(annotations[13].annotation.annotationType).to.equal('BinaryAnnotation');
            expect(annotations[13].annotation.key).to.equal('error');
            expect(annotations[13].annotation.value).to.equal('404');

            expect(annotations[14].annotation.annotationType).to.equal('ClientRecv');

            expect(annotations[20]).to.be.undefined; // eslint-disable-line no-unused-expressions

            const currentSpan = tracer.id.spanId;
            expect(currentSpan).to.equal(rootId.spanId,
                'Current span should\'ve been restored to the original parent');

            done();
          });
        });
      });
    });
  });
});
