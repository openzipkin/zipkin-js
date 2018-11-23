import uuid from 'uuid/v4';
import CLSContext from 'zipkin-context-cls';
import {Tracer} from 'zipkin';
import sinon from 'sinon';
import request from 'superagent';
import zipkinPlugin from '../src/superagentPlugin';
import {mockServer} from './utils';

describe('SuperAgent instrumentation (integration test)', () => {
  const localServiceName = 'test-client';
  const remoteServiceName = 'test-server';

  let server;
  before((done) => {
    const mock = mockServer();
    server = mock.listen(0, () => done());
  });

  after((done) => {
    server.close(() => done());
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

  it('should record successful request', done => {
    tracer.scoped(() => {
      const port = server.address().port;
      const host = '127.0.0.1';
      const path = '/test/202';

      request.get(`http://${host}:${port}${path}`)
        .use(zipkinPlugin({tracer, remoteServiceName}))
        .end((err, res) => {
          const {body} = res;
          const annotations = record.args.map(args => args[0]);
          const traceId = annotations[0].traceId.traceId;
          const spanId = annotations[0].traceId.spanId;

          annotations.forEach(annot => {
            expect(annot.traceId.traceId).to.equal(traceId).and.to.have.lengthOf(16);
          });

          expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
          expect(annotations[0].annotation.serviceName).to.equal(localServiceName);

          expect(annotations[1].annotation.annotationType).to.equal('Rpc');
          expect(annotations[1].annotation.name).to.equal('GET');

          expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[2].annotation.key).to.equal('http.path');
          expect(annotations[2].annotation.value).to.equal(path);

          expect(annotations[3].annotation.annotationType).to.equal('ClientSend');

          expect(annotations[4].annotation.annotationType).to.equal('ServerAddr');

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('202');

          expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');

          const traceIdOnServer = body.traceId;
          expect(traceIdOnServer).to.equal(traceId);

          const spanIdOnServer = body.spanId;
          expect(spanIdOnServer).to.equal(spanId);
          done();
        });
    });
  });

  it('should report 404 when path does not exist', done => {
    tracer.scoped(() => {
      const port = server.address().port;
      const host = '127.0.0.1';
      const path = '/test/303';

      request.get(`http://${host}:${port}${path}`)
        .use(zipkinPlugin({tracer, remoteServiceName}))
        .end(() => {
          const annotations = record.args.map(args => args[0]);
          const traceId = annotations[0].traceId.traceId;

          annotations.forEach(annot => {
            expect(annot.traceId.traceId).to.equal(traceId).and.to.have.lengthOf(16);
          });

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('404');

          expect(annotations[6].annotation.key).to.equal('error');
          expect(annotations[6].annotation.value).to.equal('404');
          done();
        });
    });
  });

  it('should report error when service returns 400', done => {
    tracer.scoped(() => {
      const port = server.address().port;
      const host = '127.0.0.1';
      const path = '/test/400';

      request.get(`http://${host}:${port}${path}`)
        .use(zipkinPlugin({tracer, remoteServiceName}))
        .end(() => {
          const annotations = record.args.map(args => args[0]);
          const traceId = annotations[0].traceId.traceId;

          annotations.forEach(annot => {
            expect(annot.traceId.traceId).to.equal(traceId).and.to.have.lengthOf(16);
          });

          expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
          expect(annotations[5].annotation.key).to.equal('http.status_code');
          expect(annotations[5].annotation.value).to.equal('400');

          expect(annotations[6].annotation.key).to.equal('error');
          expect(annotations[6].annotation.value).to.equal('400');
          done();
        });
    });
  });
});
