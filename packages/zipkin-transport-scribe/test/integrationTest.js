const {
  Tracer,
  TraceId,
  BatchRecorder,
  Annotation,
  ExplicitContext,
  option: {Some}
} = require('zipkin');
const thrift = require('thrift');
const sinon = require('sinon');
const ScribeLogger = require('../src/ScribeLogger');
const Scribe = require('./gen-nodejs/scribe');
const {ResultCode} = require('./gen-nodejs/scribeServer_types');

describe('Scribe transport - integration test', () => {
  it('should send trace data to Scribe', done => {
    const logSpy = sinon.spy();
    const scribeHandler = {
      Log: (messages, result) => {
        logSpy(messages, result);
        result(ResultCode.OK);
      }
    };

    const server = thrift.createServer(Scribe, scribeHandler, {
      transport: thrift.TFramedTransport,
      protocol: thrift.TBinaryProtocol
    });
    const scribeServer = server.listen(0, () => {
      const port = scribeServer.address().port;
      const logger = new ScribeLogger({
        scribeHost: '127.0.0.1',
        scribePort: port,
        scribeInterval: 1
      });

      const ctxImpl = new ExplicitContext();
      const recorder = new BatchRecorder({logger});
      const tracer = new Tracer({recorder, ctxImpl});
      ctxImpl.scoped(() => {
        const id = new TraceId({
          traceId: new Some('abc'),
          parentId: new Some('def'),
          spanId: '123',
          sampled: new Some(true),
          flags: 0
        });
        tracer.setId(id);
        tracer.recordAnnotation(new Annotation.ClientSend());
        tracer.recordAnnotation(new Annotation.ClientRecv());
        setTimeout(() => {
          scribeServer.close();

          expect(logSpy.called).to.equal(true, 'Logger was not called as expected');
          const firstCall = logSpy.getCall(0);
          if (firstCall) {
            expect(firstCall.args[0][0].message).to.include(
              'CgABAAAAAAAACrwLAAMAAAAHVW5rbm93bgoABAAAAAAAAAEj');
          }
          done();
        }, 150);
      });
    });
  });
});
