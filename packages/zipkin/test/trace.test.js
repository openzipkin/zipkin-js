const sinon = require('sinon');
const lolex = require('lolex');
const Promise = require('bluebird');
const isPromise = require('is-promise');
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

  it('should clear scope after letId', () => {
    const recorder = {
      record: () => {}
    };
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({ctxImpl, recorder});

    ctxImpl.scoped(() => {
      const parentId = tracer.createRootId();
      const childId = tracer.createChildId();

      tracer.setId(parentId);
      tracer.letId(childId, () => {
        expect(tracer.id).to.equal(childId);

        tracer.letId(parentId, () => {
          expect(tracer.id).to.equal(parentId);
        });

        expect(tracer.id).to.equal(childId);
      });

      expect(tracer.id).to.equal(parentId);
    });
  });

  it('should make a local span', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const localServiceName = 'smoothie-store';
    const trace = new Tracer({ctxImpl, recorder, localServiceName});

    ctxImpl.scoped(() => {
      const result = trace.local('buy-smoothie', () => {
        trace.recordBinary('taste', 'banana');
        return 'smoothie';
      });

      expect(result).to.eql('smoothie');

      expect(record.getCall(0).args[0].annotation).to.eql(
        new Annotation.ServiceName('smoothie-store')
      );
      expect(record.getCall(1).args[0].annotation).to.eql(
        new Annotation.LocalOperationStart('buy-smoothie')
      );
      expect(record.getCall(2).args[0].annotation).to.eql(
        new Annotation.BinaryAnnotation('taste', 'banana')
      );
      expect(record.getCall(3).args[0].annotation).to.eql(
        new Annotation.LocalOperationStop()
      );
    });
  });

  it('should complete a local span on error type', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const localServiceName = 'smoothie-store';
    const trace = new Tracer({ctxImpl, recorder, localServiceName});

    ctxImpl.scoped(() => {
      let error;
      try {
        trace.local('buy-smoothie', () => {
          throw new Error('no smoothies. try our cake');
        });
      } catch (err) {
        error = err; // error wasn't swallowed
      }

      // sanity check
      expect(error).to.eql(new Error('no smoothies. try our cake'));

      expect(record.getCall(0).args[0].annotation).to.eql(
        new Annotation.ServiceName('smoothie-store')
      );
      expect(record.getCall(1).args[0].annotation).to.eql(
        new Annotation.LocalOperationStart('buy-smoothie')
      );
      expect(record.getCall(2).args[0].annotation).to.eql(
        new Annotation.BinaryAnnotation('error', 'no smoothies. try our cake')
      );
      expect(record.getCall(3).args[0].annotation).to.eql(
        new Annotation.LocalOperationStop() // stopped on error
      );
    });
  });

  it('should make a local span for a promise', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const localServiceName = 'smoothie-store';
    const trace = new Tracer({ctxImpl, recorder, localServiceName});

    ctxImpl.scoped(() => {
      const promise = trace.local('buy-smoothie', () =>
        Promise.delay(10)
               .then(() => 'smoothie')
      );

      expect(isPromise(promise)).to.eql(true);

      // but the start event's timestamp is still correct
      expect(record.getCall(0).args[0].annotation).to.eql(
        new Annotation.ServiceName('smoothie-store')
      );
      expect(record.getCall(1).args[0].annotation).to.eql(
        new Annotation.LocalOperationStart('buy-smoothie')
      );

      // hasn't finished yet, due to the delay
      expect(record.getCall(2)).to.eql(null);

      return promise.then((result) => {
        expect(result).to.eql('smoothie');

        expect(record.getCall(2).args[0].annotation).to.eql(
          new Annotation.LocalOperationStop()
        );
      });
    });
  });

  it('should close the correct span for a promise', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const localServiceName = 'smoothie-store';
    const trace = new Tracer({ctxImpl, recorder, localServiceName});

    ctxImpl.scoped(() => {
      const promise = trace.local('buy-smoothie', () =>
        Promise.delay(10)
               .then(() => 'smoothie')
      );

      expect(isPromise(promise)).to.eql(true);

      // hasn't finished yet, due to the delay
      expect(record.getCall(2)).to.eql(null);
      const expectedTraceId = record.getCall(1).args[0].traceId;

      return promise.then((result) => {
        expect(result).to.eql('smoothie');

        expect(record.getCall(2).args[0].traceId).to.eql(
          expectedTraceId
        );
      });
    });
  });

  it('should make a local span for a promise that produces an error', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const localServiceName = 'smoothie-store';
    const trace = new Tracer({ctxImpl, recorder, localServiceName});

    ctxImpl.scoped(() => {
      const promise = trace.local('buy-smoothie', () =>
        Promise.delay(10)
               .then(() => {
                 trace.recordBinary('taste', 'banana');
                 return 'smoothie';
               })
      );

      expect(isPromise(promise)).to.eql(true);

      // but the start event's timestamp is still correct
      expect(record.getCall(0).args[0].annotation).to.eql(
        new Annotation.ServiceName('smoothie-store')
      );
      expect(record.getCall(1).args[0].annotation).to.eql(
        new Annotation.LocalOperationStart('buy-smoothie')
      );

      // hasn't finished yet, due to the delay
      expect(record.getCall(2)).to.eql(null);

      return promise.then((result) => {
        expect(result).to.eql('smoothie');

        expect(record.getCall(2).args[0].annotation).to.eql(
          new Annotation.BinaryAnnotation('taste', 'banana')
        );
        expect(record.getCall(3).args[0].annotation).to.eql(
          new Annotation.LocalOperationStop()
        );
      });
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
