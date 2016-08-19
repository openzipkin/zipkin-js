const sinon = require('sinon');
const lolex = require('lolex');

const Tracer = require('../src/tracer');
const Annotation = require('../src/annotation');
const {Sampler} = require('../src/tracer/sampler');
const ExplicitContext = require('../src/explicit-context');
const {Some} = require('../src/option');

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

  it('should log timestamps in microseconds', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const trace = new Tracer({ctxImpl, recorder});

    ctxImpl.scoped(() => {
      const clock = lolex.install(12345678);
      trace.recordAnnotation(new Annotation.ServerSend());
      clock.tick(1); // everything else is beyond this
      trace.recordMessage('error');

      expect(record.getCall(0).args[0].timestamp).to.equal(12345678000);
      expect(record.getCall(1).args[0].timestamp).to.equal(12345679000);

      clock.uninstall();
    });
  });
});
