const sinon = require('sinon');
const {Tracer, ExplicitContext} = require('zipkin');
const zipkinClient = require('../src/zipkinClient');

const memcachedConnectionOptions = {
  timeout: 1000,
  idle: 1000,
  failures: 0,
  retries: 0,
  poolsize: 1
};

const Memcached = require('memcached');

function getMemcached(tracer) {
  const host = process.env.MEMCACHED_HOST || 'localhost:11211';
  console.log(`Connecting to Memcached on host ${host}`);
  return new (zipkinClient(tracer, Memcached))(host, memcachedConnectionOptions);
}

describe('memcached interceptor', () => {
  it('should add zipkin annotations', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    // const recorder = new ConsoleRecorder();
    const tracer = new Tracer({ctxImpl, recorder});

    const memcached = getMemcached(tracer);
    memcached.on('error', done);
    tracer.setId(tracer.createRootId());
    const ctx = ctxImpl.getContext();
    memcached.set('ping', 'pong', 10, () => {
      ctxImpl.letContext(ctx, () => {
        memcached.get('ping', () => {
          const annotations = recorder.record.args.map(args => args[0]);
          const firstAnn = annotations[0];

          expect(annotations).to.have.length(12);

          function runTest(start, stop) {
            const spanAnnotations = annotations.slice(start, stop);

            const sn = spanAnnotations[1].annotation;
            expect(sn.annotationType).to.equal('ServiceName');
            expect(sn.serviceName).to.equal('unknown');

            const sa = spanAnnotations[4].annotation;
            expect(sa.annotationType).to.equal('ServerAddr');
            expect(sa.serviceName).to.equal('memcached');

            let lastSpanId;
            spanAnnotations.forEach((ann) => {
              if (!lastSpanId) {
                lastSpanId = ann.traceId.spanId;
              }
              expect(ann.traceId.spanId).to.equal(lastSpanId);
            });
          }

          // we expect two spans, run annotations tests for each
          runTest(0, annotations.length / 2);
          runTest(annotations.length / 2, annotations.length);

          expect(
            annotations[0].traceId.spanId
          ).not.to.equal(annotations[annotations.length / 2].traceId.spanId);

          annotations.forEach(ann => {
            expect(ann.traceId.parentSpanId.getOrElse()).to.equal(firstAnn.traceId.traceId);
            expect(ann.traceId.spanId).not.to.equal(firstAnn.traceId.traceId);
            expect(ann.traceId.traceId).to.equal(firstAnn.traceId.traceId);
          });
          done();
        });
      });
    });
  });

  it('should run memcached calls', done => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: () => { }};
    const tracer = new Tracer({ctxImpl, recorder});
    const memcached = getMemcached(tracer);
    memcached.on('error', done);
    memcached.set('foo', 'bar', 10, err => {
      if (err) {
        done(err);
      } else {
        memcached.getMulti(['foo', 'fox'], (err2, data) => {
          if (err2) {
            done(err2);
          } else {
            expect(data).to.deep.equal({foo: 'bar'});
            done();
          }
        });
      }
    });
  });

  it('should restore original trace ID', done => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: () => { }};
    const tracer = new Tracer({ctxImpl, recorder});
    const fakeID = tracer.createRootId();
    tracer.setId(fakeID);
    const memcached = getMemcached(tracer);
    memcached.on('error', done);
    memcached.set('scooby', 'doo', 10, () => {
      expect(tracer.id.traceId).to.equal(fakeID.traceId);
      memcached.get('scooby', (err, data) => {
        expect(tracer.id.traceId).to.equal(fakeID.traceId);
        expect(data).to.equal('doo');
        done();
      });
    });
  });
});
