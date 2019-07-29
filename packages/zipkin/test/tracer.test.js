const sinon = require('sinon');
const lolex = require('lolex');
const Promise = require('bluebird');
const isPromise = require('is-promise');

const BatchRecorder = require('../src/batch-recorder');
const {JSON_V2} = require('../src/jsonEncoder');
const Annotation = require('../src/annotation');
const {Sampler, neverSample, alwaysSample} = require('../src/tracer/sampler');
const ExplicitContext = require('../src/explicit-context');
const {Some, None} = require('../src/option');
const {Endpoint} = require('../src/model');
const Tracer = require('../src/tracer');
const TraceId = require('../src/tracer/TraceId');
const {expectSpan} = require('../../../test/testFixture');

describe('Tracer', () => {
  const localServiceName = 'smoothie-store';

  let spans;
  let recorder;
  let ctxImpl;

  beforeEach(() => { // TODO: extract this logic as it is reused in tracer, client and server tests
    spans = [];
    recorder = new BatchRecorder({
      logger: {
        logSpan: (span) => {
          spans.push(JSON.parse(JSON_V2.encode(span)));
        }
      }
    });
    ctxImpl = new ExplicitContext();
  });

  afterEach(() => expect(spans).to.be.empty);

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  const rootId = new TraceId({
    traceId: '5c7d31940cb80828',
    spanId: 'cb37670e772e86e2',
    sampled: new Some(true)
  });

  it('should make parent and child spans', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    tracer.setId(rootId);
    const parentId = tracer.createChildId();
    tracer.setId(parentId);

    ctxImpl.scoped(() => {
      const childId = tracer.createChildId();
      tracer.setId(childId);

      expect(tracer.id.traceId).to.equal(parentId.traceId);
      expect(tracer.id.parentSpanId.getOrElse()).to.equal(parentId.spanId);

      ctxImpl.scoped(() => {
        const grandChildId = tracer.createChildId();
        tracer.setId(grandChildId);

        expect(tracer.id.traceId).to.equal(childId.traceId);
        expect(tracer.id.parentSpanId.getOrElse()).to.equal(childId.spanId);
      });
    });
  });

  it('should consider sentinel id as root', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    // There's currently no api to tell if there is a tracer in progress or not.
    // The only exposed mechanism is Tracer.id, which can return a sentinel value.
    const sentinel = tracer.id;

    tracer.setId(sentinel);
    const shouldBeRoot = tracer.createChildId();
    // When createChildId is called with the sentinel, we expect a new root span
    expect(shouldBeRoot.parentSpanId.getOrElse(null)).to.equal(null);
  });

  it('should clear scope after letId', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    tracer.setId(rootId);
    const childId = tracer.createChildId();

    tracer.letId(childId, () => {
      expect(tracer.id).to.equal(childId);

      tracer.letId(rootId, () => {
        expect(tracer.id).to.equal(rootId);
      });

      expect(tracer.id).to.equal(childId);
    });

    expect(tracer.id).to.equal(rootId);
  });

  it('should make a local span', () => {
    const tracer = new Tracer({ctxImpl, recorder, localServiceName});

    const result = tracer.local('buy-smoothie', () => {
      tracer.recordBinary('taste', 'banana');
      return 'smoothie';
    });

    expect(result).to.eql('smoothie');

    expectSpan(popSpan(), {
      name: 'buy-smoothie',
      localEndpoint: {serviceName: localServiceName},
      tags: {taste: 'banana'}
    });
  });

  it('setTags should record tags as binary annotations', () => {
    const tracer = new Tracer({ctxImpl, recorder, localServiceName});
    const tags = {instanceId: 'i-1234567890abcdef0', cluster: 'nodeservice-stage'};

    tracer.setId(rootId);
    tracer.setTags(tags);
    tracer.recordAnnotation(new Annotation.ServerSend());

    expect(popSpan().tags).to.deep.equal(tags);
  });

  it('should complete a local span on error type', () => {
    const tracer = new Tracer({ctxImpl, recorder, localServiceName});

    let error;
    try {
      tracer.local('buy-smoothie', () => {
        throw new Error('no smoothies. try our cake');
      });
    } catch (err) {
      error = err; // error wasn't swallowed
    }

    // sanity check
    expect(error).to.eql(new Error('no smoothies. try our cake'));

    expectSpan(popSpan(), {
      name: 'buy-smoothie',
      localEndpoint: {serviceName: localServiceName},
      tags: {error: 'no smoothies. try our cake'}
    });
  });

  it('should make a local span for a promise', () => {
    const tracer = new Tracer({ctxImpl, recorder, localServiceName});

    const promise = tracer.local('buy-smoothie', () => Promise.delay(10)
      .then(() => 'smoothie'));

    expect(isPromise(promise)).to.eql(true);

    // hasn't finished yet, due to the delay
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions

    return promise.then((result) => {
      expect(result).to.eql('smoothie');

      expectSpan(popSpan(), {
        name: 'buy-smoothie',
        localEndpoint: {serviceName: localServiceName}
      });
    });
  });

  it('should close the correct span for a promise', () => {
    const tracer = new Tracer({ctxImpl, recorder, localServiceName});

    const promise = tracer.local('buy-smoothie', () => Promise.delay(10)
      .then(() => 'smoothie'));

    expect(isPromise(promise)).to.eql(true);

    // hasn't finished yet, due to the delay
    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions

    return promise.then((result) => {
      expect(result).to.eql('smoothie');

      expectSpan(popSpan(), {
        name: 'buy-smoothie',
        localEndpoint: {serviceName: localServiceName}
      });
    });
  });

  it('should make a local span for a promise that produces an error', () => {
    // TODO: write me. the previous code didn't actually test this
  });

  function runTest(bool, done) {
    const sampler = new Sampler(() => bool);
    const tracer = new Tracer({sampler, recorder, ctxImpl});

    const newRootId = tracer.createRootId();
    expect(newRootId.sampled).to.eql(new Some(bool));
    done();
  }

  it('should set sampled flag when shouldSample is true', (done) => {
    runTest(true, done);
  });

  it('should set sampled flag when shouldSample is false', (done) => {
    runTest(false, done);
  });

  it('should not record unsampled spans', () => {
    const sampler = new Sampler(neverSample);
    const tracer = new Tracer({ctxImpl, recorder, sampler});

    tracer.recordMessage('error');
    tracer.recordAnnotation(new Annotation.ServerSend());

    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('should default to unknown endpoint', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    expect(tracer.localEndpoint).to.eql(new Endpoint({serviceName: 'unknown'}));
  });

  it('should accept localServiceName parameter', () => {
    const tracer = new Tracer({ctxImpl, recorder, localServiceName});

    expect(tracer.localEndpoint).to.eql(new Endpoint({serviceName: localServiceName}));
  });

  it('should accept localEndpoint parameter', () => {
    const localEndpoint = new Endpoint({
      serviceName: 'portal-service',
      ipv4: '10.57.50.83',
      port: 8080
    });
    const tracer = new Tracer({ctxImpl, recorder, localEndpoint});

    expect(tracer.localEndpoint).to.eql(localEndpoint);
  });

  it('should record timestamps in microseconds', () => {
    const clock = lolex.install(87654321);

    const tracer = new Tracer({ctxImpl, recorder});

    tracer.setId(rootId);
    tracer.recordMessage('error');

    clock.tick(1); // everything else is beyond this
    tracer.recordAnnotation(new Annotation.ServerSend());

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      annotations: [
        {timestamp: 87654321000, value: 'error'},
        {timestamp: 87654322000, value: 'finish'}
      ]
    });

    clock.uninstall();
  });

  it('should accept timestamp from second parameter if it present', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    tracer.setId(rootId);
    tracer.recordAnnotation(new Annotation.ServerSend(), 87654321000);

    expect(popSpan()).to.deep.equal({
      traceId: rootId.traceId,
      id: rootId.spanId,
      kind: 'SERVER',
      annotations: [{timestamp: 87654321000, value: 'finish'}]
    });
  });

  it('should create fixed-length 64-bit tracer ID by default', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    const newRootId = tracer.createRootId();
    expect(newRootId.traceId.length).to.eql(16);
  });

  it('should create fixed-length 128-bit tracer ID on traceId128Bit', () => {
    const tracer = new Tracer({ctxImpl, recorder, traceId128Bit: true});

    const newRootId = tracer.createRootId();
    expect(newRootId.traceId.length).to.eql(32);
  });

  it('should throw error when joining non TraceId value', () => {
    const tracer = new Tracer({recorder, ctxImpl});

    expect(() => { tracer.join(null); }).to.throw();
    expect(() => { tracer.join('ice cream'); }).to.throw();
  });

  it('should not throw error when joining but TraceId type mismatches', () => {
    const tracer = new Tracer({recorder, ctxImpl});

    // simulate type mismatch due to transpilation
    const notExactlyTraceId = Object.assign({}, rootId);
    expect(notExactlyTraceId instanceof TraceId).to.equal(false);

    const newTraceId = tracer.join(notExactlyTraceId);
    expect(notExactlyTraceId === newTraceId).to.equal(true);
  });

  const samplerCases = [
    new Sampler(alwaysSample),
    new Sampler(neverSample)
  ];

  samplerCases.forEach((sampler) => {
    it(`should follow sampler if sampled value is missing when joining (${sampler})`, () => {
      const tracer = new Tracer({recorder, ctxImpl, sampler});

      const rootTraceId = rootId;

      // Force sampled to None for testing
      rootTraceId._sampled = None;

      const newTraceId = tracer.join(rootTraceId);
      expect(rootTraceId == newTraceId); // eslint-disable-line eqeqeq
      expect(newTraceId._sampled.value).to.eql(sampler.shouldSample(rootTraceId).value);
    });
  });

  it('should create childId if supportsJoin=false when joining', () => {
    const tracer = new Tracer({recorder, ctxImpl, supportsJoin: false});

    const rootTraceId = rootId;

    const newTraceId = tracer.join(rootTraceId);
    expect(newTraceId.traceId).to.eql(rootTraceId.traceId);
    expect(newTraceId.parentSpanId).to.eql(new Some(rootTraceId.spanId));
    expect(newTraceId.sampled).to.eql(rootTraceId.sampled);
    expect(newTraceId.flags).to.eql(rootTraceId.flags);
  });

  it('should propagate defaultTags to recorder', () => {
    const setDefaultTags = sinon.spy();
    const mockRecorder = {setDefaultTags};
    // eslint-disable-next-line no-unused-vars
    const tracer = new Tracer({ctxImpl, recorder: mockRecorder});
    expect(setDefaultTags.called).to.eql(true);
  });

  it('should make a childId by passing parent traceId to createChildId', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    const parentTraceId = rootId;

    const childTraceId = tracer.createChildId(parentTraceId);

    expect(childTraceId.traceId).to.eql(parentTraceId.traceId);
    expect(childTraceId.parentSpanId).to.eql(new Some(parentTraceId.spanId));
    expect(childTraceId.spanId).to.not.eql(parentTraceId.spanId);
    expect(childTraceId.sampled).to.eql(parentTraceId.sampled);
    expect(childTraceId.flags).to.eql(parentTraceId.flags);
  });

  it('should make a new rootId by calling createChildId with empty parameter', () => {
    const tracer = new Tracer({ctxImpl, recorder});

    const newTraceId = tracer.createChildId();

    expect(newTraceId.parentSpanId.getOrElse(null)).to.equal(null);
  });
});
