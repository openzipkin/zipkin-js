const sinon = require('sinon');
const trace = require('../src/trace');
const ZipkinTracer = require('../src/ZipkinTracer');
const TraceId = require('../src/TraceId');
const Annotation = require('../src/annotation');
const InetAddress = require('../src/InetAddress');
const {Some, None} = require('../src/option');

describe('The raw tracer', () => {
  it('should accumulate annotations into MutableSpans', () => {
    trace.withContext(() => {
      // let spanHasBeenLogged = false;
      // let loggedSpan;

      const logSpan = sinon.spy();

      const tracer = new ZipkinTracer({
        logger: {logSpan}
      });

      trace.pushTracer(tracer);
      trace.setId(new TraceId({
        traceId: None,
        parentId: new Some('a'),
        spanId: 'c',
        sampled: new Some(true)
      }));

      trace.recordServiceName('SmoothieStore');
      trace.recordRpc('buySmoothie');
      trace.recordBinary('taste', 'banana');
      trace.recordAnnotation(new Annotation.ServerRecv());
      trace.recordAnnotation(new Annotation.LocalAddr({
        host: new InetAddress('127.0.0.1'),
        port: 7070
      }));

      // Should only log after the span is complete
      expect(logSpan.calledOnce).to.equal(false);
      trace.recordAnnotation(new Annotation.ServerSend());
      expect(logSpan.calledOnce).to.equal(true);

      const loggedSpan = logSpan.getCall(0).args[0];

      expect(loggedSpan.traceId.traceId).to.equal('a');
      expect(loggedSpan.traceId.parentId).to.equal('a');
      expect(loggedSpan.traceId.spanId).to.equal('c');
      expect(loggedSpan.complete).to.equal(true);
      expect(loggedSpan.name).to.eql(new Some('buySmoothie'));
      expect(loggedSpan.service).to.eql(new Some('SmoothieStore'));
      expect(loggedSpan.endpoint.host).to.equal(2130706433);
      expect(loggedSpan.endpoint.port).to.equal(7070);
      expect(loggedSpan.binaryAnnotations[0].key).to.equal('taste');
      expect(loggedSpan.binaryAnnotations[0].value).to.equal('banana');
      expect(loggedSpan.annotations[0].value).to.equal('sr');
      expect(loggedSpan.annotations[1].value).to.equal('ss');
    });
  });
});
