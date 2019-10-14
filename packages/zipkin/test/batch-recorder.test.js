const {expect} = require('chai');
const lolex = require('lolex');

const Annotation = require('../src/annotation');
const BatchRecorder = require('../src/batch-recorder');
const InetAddress = require('../src/InetAddress');
const {JSON_V2} = require('../src/jsonEncoder');
const {now} = require('../src/time');
const Record = require('../src/tracer/record');
const {Some} = require('../src/option');
const TraceId = require('../src/tracer/TraceId');

// This test makes data bugs easier to spot by representing transformations as v2 JSON
describe('Batch Recorder - integration test', () => {
  let spans;

  /**
   * @type {BatchRecorder}
   */
  let recorder;

  beforeEach(() => {
    spans = [];
    recorder = new BatchRecorder({
      logger: {
        logSpan: (span) => {
          spans.push(JSON.parse(JSON_V2.encode(span)));
        }
      }
    });
  });

  afterEach(() => expect(spans).to.be.empty);

  function pendingSpan(traceId) {
    return recorder.partialSpans.get(traceId);
  }

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

  function record(traceId, timestamp, annotation) {
    return new Record({traceId, timestamp, annotation});
  }

  it('should flush Spans not finished within a minute timeout', () => {
    const clock = lolex.install();
    recorder = new BatchRecorder({
      logger: {
        logSpan: (span) => {
          spans.push(JSON.parse(JSON_V2.encode(span)));
        }
      }
    });

    clock.tick('01');
    recorder.record(record(rootId, now(), new Annotation.ServerRecv()));

    clock.tick('02'); // polling interval is every second
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions

    clock.tick('01:00'); // 1 minute is the default timeout
    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      timestamp: 1000000,
      annotations: [{timestamp: 62000000, value: 'zipkin-js.flush'}]
    });

    clock.tick('02'); // Late server-send is still reported
    recorder.record(record(rootId, now(), new Annotation.ServerSend()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      annotations: [{timestamp: 65000000, value: 'finish'}]
    });

    clock.uninstall();
  });

  it('should start and finish a client span', () => {
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));
    recorder.record(record(rootId, 3, new Annotation.ClientRecv()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      timestamp: 1,
      duration: 2
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should record ServerAddr as remote endpoint in a client span', () => {
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));
    recorder.record(record(rootId, 1, new Annotation.ServerAddr({
      serviceName: 'mysql',
      host: new InetAddress('54.0.0.101'),
      port: 3306
    })));
    recorder.record(record(rootId, 3, new Annotation.ClientRecv()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      timestamp: 1,
      duration: 2,
      remoteEndpoint: {
        ipv4: '54.0.0.101',
        port: 3306,
        serviceName: 'mysql'
      }
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a server span', () => {
    recorder.record(record(rootId, 1, new Annotation.ServerRecv()));
    recorder.record(record(rootId, 3, new Annotation.ServerSend()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      timestamp: 1,
      duration: 2
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should record ClientAddr as remote endpoint in a server span', () => {
    recorder.record(record(rootId, 1, new Annotation.ServerRecv()));
    recorder.record(record(rootId, 1, new Annotation.ClientAddr({
      host: new InetAddress('54.0.0.101'),
      port: 36656
    })));
    recorder.record(record(rootId, 3, new Annotation.ServerSend()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      timestamp: 1,
      duration: 2,
      remoteEndpoint: {
        ipv4: '54.0.0.101',
        port: 36656
      }
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a shared server span', () => {
    const sharedId = new TraceId({
      traceId: '5c7d31940cb80828',
      spanId: 'cb37670e772e86e2',
      sampled: new Some(true),
      shared: true // shared is a context property
    });

    recorder.record(record(sharedId, 1, new Annotation.ServerRecv()));
    recorder.record(record(sharedId, 3, new Annotation.ServerSend()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      timestamp: 1,
      duration: 2,
      shared: true
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a producer span', () => {
    recorder.record(record(rootId, 1, new Annotation.ProducerStart()));
    recorder.record(record(rootId, 3, new Annotation.ProducerStop()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'PRODUCER',
      timestamp: 1,
      duration: 2
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should record MessageAddr as remote endpoint in a producer span', () => {
    recorder.record(record(rootId, 1, new Annotation.ProducerStart()));
    recorder.record(record(rootId, 1, new Annotation.MessageAddr({
      serviceName: 'rabbitmq'
    })));
    recorder.record(record(rootId, 3, new Annotation.ProducerStop()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'PRODUCER',
      timestamp: 1,
      duration: 2,
      remoteEndpoint: {serviceName: 'rabbitmq'}
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a consumer span', () => {
    recorder.record(record(rootId, 1, new Annotation.ConsumerStart()));
    recorder.record(record(rootId, 3, new Annotation.ConsumerStop()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CONSUMER',
      timestamp: 1,
      duration: 2
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should start and finish a local span', () => {
    recorder.record(record(rootId, 1, new Annotation.LocalOperationStart('foo')));
    recorder.record(record(rootId, 3, new Annotation.LocalOperationStop()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      name: 'foo',
      timestamp: 1,
      duration: 2
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should add default tags', () => {
    const tags = {instanceId: 'i-1234567890abcdef0', cluster: 'nodeservice-stage'};
    recorder.setDefaultTags(tags);

    recorder.record(record(rootId, 1, new Annotation.LocalOperationStart('foo')));
    recorder.record(record(rootId, 3, new Annotation.LocalOperationStop()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      name: 'foo',
      timestamp: 1,
      duration: 2,
      tags
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should accommodate late changes to span name', () => {
    recorder.record(record(rootId, 1, new Annotation.ServiceName('backend')));
    recorder.record(record(rootId, 1, new Annotation.Rpc('GET')));
    recorder.record(record(rootId, 1, new Annotation.BinaryAnnotation('http.path', '/api')));
    recorder.record(record(rootId, 1, new Annotation.ServerRecv()));

    // when the response is ready to send, we have a name change
    recorder.record(record(rootId, 3, new Annotation.Rpc('GET /api')));
    recorder.record(record(rootId, 3, new Annotation.BinaryAnnotation('http.status_code', '200')));
    recorder.record(record(rootId, 3, new Annotation.ServerSend()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      name: 'get /api',
      kind: 'SERVER',
      timestamp: 1,
      duration: 2,
      localEndpoint: {
        serviceName: 'backend'
      },
      tags: {
        'http.path': '/api',
        'http.status_code': '200'
      }
    });
  });

  it('should only flush spans when calling flush method', () => {
    recorder = new BatchRecorder({
      logger: {
        logSpan: (span) => {
          spans.push(JSON.parse(JSON_V2.encode(span)));
        }
      }
    });

    recorder.record(record(rootId, 1, new Annotation.ServerRecv()));

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions

    recorder.flush();

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      timestamp: 1
    });
  });

  it('should handle overlapping server and client', () => {
    recorder.record(record(rootId, 1, new Annotation.ServiceName('frontend')));
    recorder.record(record(rootId, 1, new Annotation.Rpc('GET')));
    recorder.record(record(rootId, 1, new Annotation.BinaryAnnotation('http.path', '/')));
    recorder.record(record(rootId, 1, new Annotation.ServerRecv()));

    recorder.record(record(childId, 3, new Annotation.ServiceName('frontend')));
    recorder.record(record(childId, 3, new Annotation.Rpc('GET')));
    recorder.record(record(childId, 3, new Annotation.BinaryAnnotation('http.path', '/api')));
    recorder.record(record(childId, 3, new Annotation.ClientSend()));
    recorder.record(record(childId, 4, new Annotation.BinaryAnnotation('error', 'ECONNREFUSED')));
    recorder.record(record(childId, 4, new Annotation.ClientRecv()));

    recorder.record(record(rootId, 6, new Annotation.BinaryAnnotation('http.status_code', '500')));
    recorder.record(record(rootId, 6, new Annotation.BinaryAnnotation('error', 'client fail')));
    recorder.record(record(rootId, 6, new Annotation.ServerSend()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      name: 'get',
      kind: 'SERVER',
      timestamp: 1,
      duration: 5,
      localEndpoint: {
        serviceName: 'frontend'
      },
      tags: {
        error: 'client fail',
        'http.path': '/',
        'http.status_code': '500'
      }
    });

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      parentId: rootId.spanId,
      id: childId.spanId,
      name: 'get',
      kind: 'CLIENT',
      timestamp: 3,
      duration: 1,
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

  it('should keep state until finished', () => {
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));
    expect(pendingSpan(rootId)).to.exist; // eslint-disable-line no-unused-expressions

    recorder.record(record(rootId, 3, new Annotation.ClientRecv()));
    expect(pendingSpan(rootId)).to.not.exist; // eslint-disable-line no-unused-expressions

    popSpan(); // consume the span created above.
  });

  /**
   * Due to the code structure of httpClient.js, we can't externally propagate the start timestamp
   * for the purpose of ensuring duration gets recorded even when flushed.
   *
   * This shows that once we refactor or replace this type, we will be able to restore duration by
   * replaying the start event, and without causing confusion when there is not flush.
   */
  it('should allow redundant reporting of start timestamp', () => {
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));

    // pretend an async callback redundantly replays the send event
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));
    recorder.record(record(rootId, 3, new Annotation.ClientRecv()));

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      timestamp: 1,
      duration: 2
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should report sane data even on timeout', () => {
    recorder.setDefaultTags({environment: 'production'});

    recorder.record(record(rootId, 1, new Annotation.ServiceName('frontend')));
    recorder.record(record(rootId, 1, new Annotation.Rpc('GET')));
    recorder.record(record(rootId, 1, new Annotation.BinaryAnnotation('http.path', '/api')));
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));
    recorder._writeSpan(rootId, pendingSpan(rootId)); // simulate timeout
    expect(pendingSpan(rootId)).to.not.exist; // eslint-disable-line no-unused-expressions

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      timestamp: 1,
      name: 'get',
      localEndpoint: {
        serviceName: 'frontend'
      },
      tags: {
        environment: 'production',
        'http.path': '/api'
      }
    });

    recorder.record(record(rootId, 3, new Annotation.BinaryAnnotation('error', 'timeout')));
    recorder.record(record(rootId, 3, new Annotation.ClientRecv()));
    expect(pendingSpan(rootId)).to.not.exist; // eslint-disable-line no-unused-expressions

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      // there's no duration here as start timestamp was lost due to the flush
      annotations: [{timestamp: 3, value: 'finish'}],
      // note: default tags are intentionally not redundantly copied
      tags: {
        error: 'timeout'
      }
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  /* This shows that a single finish event can trigger a report after a flush */
  it('should report sane minimal data even on timeout', () => {
    recorder.record(record(rootId, 1, new Annotation.ClientSend()));
    recorder._writeSpan(rootId, pendingSpan(rootId)); // simulate timeout
    expect(pendingSpan(rootId)).to.not.exist; // eslint-disable-line no-unused-expressions

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      timestamp: 1
    });

    recorder.record(record(rootId, 3, new Annotation.ClientRecv()));
    expect(pendingSpan(rootId)).to.not.exist; // eslint-disable-line no-unused-expressions

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'CLIENT',
      // there's no duration here as start timestamp was lost due to the flush
      annotations: [{timestamp: 3, value: 'finish'}]
    });

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should not log span that is not in partial spans list', () => {
    const span = {
      delegate: {
        timestamp: 1,
        setLocalEndpoint: () => {}
      }
    };
    recorder._writeSpan(rootId, span);
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });
});
