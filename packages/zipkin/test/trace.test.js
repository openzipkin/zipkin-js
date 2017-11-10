const sinon = require('sinon');
const lolex = require('lolex');

const Tracer = require('../src/tracer');
const Annotation = require('../src/annotation');
const {Sampler, neverSample} = require('../src/tracer/sampler');
const ExplicitContext = require('../src/explicit-context');
const {Some} = require('../src/option');
const {Endpoint} = require('../src/model');

describe('Tracer', () => {
  it('should make parent and child spans', () => {
    const recorder = {
      record: () => {}
    };
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder});

    ctxImpl.scoped(() => {
      tracer.setId(tracer.createRootId());
      const parentId = tracer.createChildId();
      tracer.setId(parentId);

      ctxImpl.scoped(() => {
        const childId = tracer.createChildId();
        tracer.setId(childId);

        expect(tracer.id.traceId).to.equal(parentId.traceId);
        expect(tracer.id.parentId).to.equal(parentId.spanId);

        ctxImpl.scoped(() => {
          const grandChildId = tracer.createChildId();
          tracer.setId(grandChildId);

          expect(tracer.id.traceId).to.equal(childId.traceId);
          expect(tracer.id.parentId).to.equal(childId.spanId);
        });
      });
    });
  });

  it('should make a local span', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder});

    ctxImpl.scoped(() => {
      const result = tracer.local('test', () => {
        tracer.recordMessage('error');
        return 'foo';
      });

      expect(result).to.eql('foo');

      expect(record.getCall(0).args[0].annotation).to.eql(
        new Annotation.LocalOperationStart('test')
      );
      expect(record.getCall(1).args[0].annotation).to.eql(
        new Annotation.Message('error')
      );
      expect(record.getCall(2).args[0].annotation).to.eql(
        new Annotation.LocalOperationStop()
      );
    });
  });

  function runTest(bool, done) {
    const recorder = {
      record: sinon.spy()
    };
    const ctxImpl = new ExplicitContext();
    const sampler = new Sampler(() => bool);
    const tracer = new Tracer({
      sampler,
      recorder,
      ctxImpl
    });
    ctxImpl.scoped(() => {
      const rootTracerId = tracer.createRootId();
      expect(rootTracerId.sampled).to.eql(new Some(bool));
      done();
    });
  }

  it('should set sampled flag when shouldSample is true', done => {
    runTest(true, done);
  });

  it('should set sampled flag when shouldSample is false', done => {
    runTest(false, done);
  });

  it('should not record unsampled spans', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const sampler = new Sampler(neverSample);
    const trace = new Tracer({ctxImpl, recorder, sampler});

    ctxImpl.scoped(() => {
      trace.recordAnnotation(new Annotation.ServerSend());
      trace.recordMessage('error');

      expect(record.getCall(0)).to.equal(null);
    });
  });

  it('should default to unknown endpoint', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const trace = new Tracer({ctxImpl, recorder});

    expect(trace.localEndpoint).to.eql(new Endpoint({serviceName: 'unknown'}));
  });

  it('should accept localServiceName parameter', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const trace = new Tracer({ctxImpl, recorder, localServiceName: 'robot'});

    expect(trace.localEndpoint).to.eql(new Endpoint({serviceName: 'robot'}));
  });

  it('should accept localEndpoint parameter', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const localEndpoint = new Endpoint({
      serviceName: 'portal-service',
      ipv4: '10.57.50.83',
      port: 8080
    });
    const trace = new Tracer({ctxImpl, recorder, localEndpoint});

    expect(trace.localEndpoint).to.eql(localEndpoint);
  });

  it('should log timestamps in microseconds', () => {
    const clock = lolex.install(12345678);

    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const trace = new Tracer({ctxImpl, recorder});

    ctxImpl.scoped(() => {
      trace.recordAnnotation(new Annotation.ServerSend());
      clock.tick(1); // everything else is beyond this
      trace.recordMessage('error');

      expect(record.getCall(0).args[0].timestamp).to.equal(12345678000);
      expect(record.getCall(1).args[0].timestamp).to.equal(12345679000);
    });
    clock.uninstall();
  });

  it('should create fixed-length 64-bit trace ID by default', () => {
    const recorder = {
      record: () => {}
    };
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder});

    const rootTracerId = tracer.createRootId();
    expect(rootTracerId.traceId.length).to.eql(16);
  });

  it('should create fixed-length 128-bit trace ID on traceId128Bit', () => {
    const recorder = {
      record: () => {}
    };
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder, traceId128Bit: true});

    const rootTracerId = tracer.createRootId();
    expect(rootTracerId.traceId.length).to.eql(32);
  });
});
