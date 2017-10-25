const {
  Tracer,
  TraceId,
  BatchRecorder,
  Annotation,
  ExplicitContext,
  option: {Some}
} = require('zipkin');
const thrift = require('thrift');
const thriftTypes = require('../../zipkin-encoder-thrift/src/gen-nodejs/zipkinCore_types');
const sinon = require('sinon');
const ScribeLogger = require('../src/ScribeLogger');
const Scribe = require('./gen-nodejs/scribe');
const {ResultCode} = require('./gen-nodejs/scribeServer_types');
const {toByteArray: base64decode} = require('base64-js');

function deserialize(serialized) {
  const res = new thriftTypes.Span();
  res.read(new thrift.TBinaryProtocol(new thrift.TFramedTransport(serialized)));
  return res;
}

describe('Scribe transport - integration test', () => {
  it('should send trace data to Scribe', (done) => {
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
        tracer.recordAnnotation(new Annotation.ServerAddr({serviceName: 'test'}));
        tracer.recordAnnotation(new Annotation.ClientSend());
        tracer.recordAnnotation(new Annotation.ClientRecv());
        setTimeout(() => {
          scribeServer.close();

          expect(logSpy.called).to.equal(true, 'Logger was not called as expected');
          const firstCall = logSpy.getCall(0);
          if (firstCall) {
            const serialized = base64decode(firstCall.args[0][0].message);
            const span = deserialize(serialized); // sanity check a little data
            expect(span.trace_id.toNumber()).to.equal(2748);
            expect(span.annotations.length).to.equal(2);
            expect(span.binary_annotations.length).to.equal(1);
          }
          done();
        }, 150);
      });
    });
  });
});
