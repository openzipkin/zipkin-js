const {expect} = require('chai');
const {expectSpan} = require('../../../test/testFixture');

const Annotation = require('../src/annotation');
const BatchRecorder = require('../src/batch-recorder');
const {JSON_V2} = require('../src/jsonEncoder');
const Record = require('../src/tracer/record');
const TraceId = require('../src/tracer/TraceId');

// This test makes data bugs easier to spot by representing transformations as v2 JSON
describe('Batch Recorder - integration test', () => {
  let spans;
  let recorder;

  beforeEach(() => {
    spans = [];
    recorder = new BatchRecorder({logger: {logSpan: (span) => {
      spans.push(JSON.parse(JSON_V2.encode(span)));
    }}});
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  const traceId = new TraceId({
    traceId: '48485a3953bb6124',
    spanId: '863ac35c9f6413ad'
  });

  it('should start and finish a client span', () => {
    recorder.record(new Record({traceId, annotation: new Annotation.ClientSend()}));
    recorder.record(new Record({traceId, annotation: new Annotation.ClientRecv()}));

    expectSpan(popSpan(), {
      kind: 'CLIENT',
    });

    expect(recorder.partialSpans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a server span', () => {
    recorder.record(new Record({traceId, annotation: new Annotation.ServerRecv()}));
    recorder.record(new Record({traceId, annotation: new Annotation.ServerSend()}));

    expectSpan(popSpan(), {
      kind: 'SERVER',
    });

    expect(recorder.partialSpans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a producer span', () => {
    recorder.record(new Record({traceId, annotation: new Annotation.ProducerStart()}));
    recorder.record(new Record({traceId, annotation: new Annotation.ProducerStop()}));

    expectSpan(popSpan(), {
      kind: 'PRODUCER',
    });

    expect(recorder.partialSpans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a consumer span', () => {
    recorder.record(new Record({traceId, annotation: new Annotation.ConsumerStart()}));
    recorder.record(new Record({traceId, annotation: new Annotation.ConsumerStop()}));

    expectSpan(popSpan(), {
      kind: 'CONSUMER',
    });

    expect(recorder.partialSpans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a local span', () => {
    recorder.record(new Record({traceId, annotation: new Annotation.LocalOperationStart('foo')}));
    recorder.record(new Record({traceId, annotation: new Annotation.LocalOperationStop()}));

    expectSpan(popSpan(), {
      name: 'foo',
    });

    expect(recorder.partialSpans).to.be.empty; // eslint-disable-line no-unused-expressions
  });
});
