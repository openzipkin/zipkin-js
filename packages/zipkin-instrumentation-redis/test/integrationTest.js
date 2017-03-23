const sinon = require('sinon');
const {Tracer, ExplicitContext} = require('zipkin');
const zipkinClient = require('../src/zipkinClient');

const redisConnectionOptions = {
  host: 'localhost',
  port: '6379'
};

const Redis = require('redis');

function getRedis(tracer) {
  return zipkinClient(tracer, Redis, redisConnectionOptions);
}

describe('redis interceptor', () => {
  it('should add zipkin annotations', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    // const recorder = new ConsoleRecorder();
    const tracer = new Tracer({ctxImpl, recorder});

    const redis = getRedis(tracer);
    redis.on('error', done);
    tracer.setId(tracer.createRootId());
    const ctx = ctxImpl.getContext();
    redis.set('ping', 'pong', 10, () => {
      ctxImpl.letContext(ctx, () => {
        redis.get('ping', () => {
          const annotations = recorder.record.args.map(args => args[0]);
          const firstAnn = annotations[0];
          expect(annotations).to.have.length(10);

          function runTest(start, stop) {
            const spanAnnotations = annotations.slice(start, stop);

            const sn = spanAnnotations[1].annotation;
            expect(sn.annotationType).to.equal('ServiceName');
            expect(sn.serviceName).to.equal('unknown');

            const sa = spanAnnotations[2].annotation;
            expect(sa.annotationType).to.equal('ServerAddr');
            expect(sa.serviceName).to.equal('redis');
            expect(sa.host.addr).to.equal(redisConnectionOptions.host);
            expect(sa.port).to.equal(redisConnectionOptions.port);

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
            expect(ann.traceId.parentId).to.equal(firstAnn.traceId.traceId);
            expect(ann.traceId.spanId).not.to.equal(firstAnn.traceId.traceId);
            expect(ann.traceId.traceId).to.equal(firstAnn.traceId.traceId);
          });

          done();
        });
      });
    });
  });

  it('should run redis calls', done => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: () => { }};
    const tracer = new Tracer({ctxImpl, recorder});
    const redis = getRedis(tracer);
    redis.on('error', done);
    redis.set('foo', 'bar', err => {
      if (err) {
        done(err);
      } else {
        redis.get('foo', (err2, data) => {
          if (err2) {
            done(err2);
          } else {
            expect(data).to.deep.equal('bar');
            done();
          }
        });
      }
    });
  });
});
