const {expect} = require('chai');
const {expectSpan} = require('../../../test/testFixture');

const Annotation = require('../src/annotation');
const BatchRecorder = require('../src/batch-recorder');
const {JSON_V2} = require('../src/jsonEncoder');
const Record = require('../src/tracer/record');
const {Some} = require('../src/option');
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

  const rootId = new TraceId({
    traceId: '5c7d31940cb80828',
    spanId: 'cb37670e772e86e2',
    sampled: new Some(true)
  });

  const childId = new TraceId({
    traceId: rootId.traceId,
    parentId: new Some(rootId.spanId),
    spanId: '5a4c253bd195eaf9',
    sampled: new Some(true)
  });

  function newRecord(traceId, annotation) {
    return new Record({traceId, annotation});
  }

  it('should start and finish a client span', () => {
    recorder.record(newRecord(rootId, new Annotation.ClientSend()));
    recorder.record(newRecord(rootId, new Annotation.ClientRecv()));

    expectSpan(popSpan(), {
      kind: 'CLIENT',
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a server span', () => {
    recorder.record(newRecord(rootId, new Annotation.ServerRecv()));
    recorder.record(newRecord(rootId, new Annotation.ServerSend()));

    expectSpan(popSpan(), {
      kind: 'SERVER',
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a producer span', () => {
    recorder.record(newRecord(rootId, new Annotation.ProducerStart()));
    recorder.record(newRecord(rootId, new Annotation.ProducerStop()));

    expectSpan(popSpan(), {
      kind: 'PRODUCER',
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a consumer span', () => {
    recorder.record(newRecord(rootId, new Annotation.ConsumerStart()));
    recorder.record(newRecord(rootId, new Annotation.ConsumerStop()));

    expectSpan(popSpan(), {
      kind: 'CONSUMER',
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a local span', () => {
    recorder.record(newRecord(rootId, new Annotation.LocalOperationStart('foo')));
    recorder.record(newRecord(rootId, new Annotation.LocalOperationStop()));

    expectSpan(popSpan(), {
      name: 'foo',
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should accommodate late changes to span name', () => {
    recorder.record(newRecord(rootId, new Annotation.ServiceName('backend')));
    recorder.record(newRecord(rootId, new Annotation.Rpc('GET')));
    recorder.record(newRecord(rootId, new Annotation.BinaryAnnotation('http.path', '/api')));
    recorder.record(newRecord(rootId, new Annotation.ServerRecv()));

    // when the response is ready to send, we have a name change
    recorder.record(newRecord(rootId, new Annotation.Rpc('GET /api')));
    recorder.record(newRecord(rootId, new Annotation.BinaryAnnotation('http.status_code', '200')));
    recorder.record(newRecord(rootId, new Annotation.ServerSend()));

    expectSpan(popSpan(), {
      name: 'get /api',
      kind: 'SERVER',
      localEndpoint: {
        serviceName: 'backend'
      },
      tags: {
        'http.path': '/api',
        'http.status_code': '200'
      }
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should handle overlapping server and client', () => {
    recorder.record(newRecord(rootId, new Annotation.ServiceName('frontend')));
    recorder.record(newRecord(rootId, new Annotation.Rpc('GET')));
    recorder.record(newRecord(rootId, new Annotation.BinaryAnnotation('http.path', '/')));
    recorder.record(newRecord(rootId, new Annotation.ServerRecv()));

    recorder.record(newRecord(childId, new Annotation.ServiceName('frontend')));
    recorder.record(newRecord(childId, new Annotation.Rpc('GET')));
    recorder.record(newRecord(childId, new Annotation.BinaryAnnotation('http.path', '/api')));
    recorder.record(newRecord(childId, new Annotation.ClientSend()));
    recorder.record(newRecord(childId, new Annotation.BinaryAnnotation('error', 'ECONNREFUSED')));
    recorder.record(newRecord(childId, new Annotation.ClientRecv()));

    recorder.record(newRecord(rootId, new Annotation.BinaryAnnotation('http.status_code', '500')));
    recorder.record(newRecord(rootId, new Annotation.BinaryAnnotation('error', 'client fail')));
    recorder.record(newRecord(rootId, new Annotation.ServerSend()));

    expectSpan(popSpan(), {
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {
        serviceName: 'frontend'
      },
      tags: {
        error: 'client fail',
        'http.path': '/',
        'http.status_code': '500'
      }
    });

    expectSpan(popSpan(), {
      parentId: rootId.spanId,
      name: 'get',
      kind: 'CLIENT',
      localEndpoint: {
        serviceName: 'frontend'
      },
      tags: {
        error: 'ECONNREFUSED',
        'http.path': '/api'
      }
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });
});
