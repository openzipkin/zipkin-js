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

function expectAnnotationsDescribeRedisInteraction(annotations) {
  const sn = annotations[1].annotation;
  expect(sn.annotationType).to.equal('ServiceName');
  expect(sn.serviceName).to.equal('unknown');

  const sa = annotations[2].annotation;
  expect(sa.annotationType).to.equal('ServerAddr');
  expect(sa.serviceName).to.equal('redis');
  expect(sa.host.addr).to.equal(redisConnectionOptions.host);
  expect(sa.port).to.equal(redisConnectionOptions.port);
}

function expectAnnotationsBelongToTheSameSpan(annotations) {
  let lastSpanId;
  annotations.forEach((ann) => {
    if (!lastSpanId) {
      lastSpanId = ann.traceId.spanId;
    }
    expect(ann.traceId.spanId).to.equal(lastSpanId);
  });
}

function runTest(annotations) {
  expectAnnotationsDescribeRedisInteraction(annotations);
  expectAnnotationsBelongToTheSameSpan(annotations);
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
    redis.set('ping', 'pong', 10, () => {
      redis.get('ping', () => {
        const annotations = recorder.record.args.map(args => args[0]);
        const firstAnn = annotations[0];
        expect(annotations).to.have.length(10);

        // we expect two spans, run annotations tests for each

        runTest(annotations.slice(0, annotations.length / 2));
        runTest(annotations.slice(annotations.length / 2, annotations.length));

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

  it('should add zipkin annotations for batch method', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    // const recorder = new ConsoleRecorder();
    const tracer = new Tracer({ctxImpl, recorder});

    const redis = getRedis(tracer);
    redis.on('error', done);
    tracer.setId(tracer.createRootId());
    redis.set('ping', 'pong', 10, () => {
      redis.batch([['get', 'ping']]).exec(() => {
        const annotations = recorder.record.args.map(args => args[0]);
        const firstAnn = annotations[0];
        expect(annotations).to.have.length(11);
        expect(annotations[5].annotation.key).to.equal('commands');
        expect(annotations[5].annotation.value).to.deep.equal('[["get","ping"]]');
        expect(annotations[6].annotation.name).to.equal('exec');

        // we expect two spans, run annotations tests for each
        expectAnnotationsBelongToTheSameSpan(
          annotations.slice(0, annotations.length / 2));
        expectAnnotationsDescribeRedisInteraction(
          annotations.slice(0, annotations.length / 2));

        expectAnnotationsBelongToTheSameSpan(
          annotations.slice(annotations.length / 2, annotations.length));
        expectAnnotationsDescribeRedisInteraction(
          annotations.slice(annotations.length / 2 + 1, annotations.length));

        expect(
          annotations[0].traceId.spanId
        ).not.to.equal(annotations[Math.floor(annotations.length / 2)].traceId.spanId);

        annotations.forEach(ann => {
          expect(ann.traceId.parentId).to.equal(firstAnn.traceId.traceId);
          expect(ann.traceId.spanId).not.to.equal(firstAnn.traceId.traceId);
          expect(ann.traceId.traceId).to.equal(firstAnn.traceId.traceId);
        });

        done();
      });
    });
  });

  it('should add zipkin annotations for multiple embedded methods', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    // const recorder = new ConsoleRecorder();
    const tracer = new Tracer({ctxImpl, recorder});

    const redis = getRedis(tracer);
    redis.on('error', done);
    tracer.setId(tracer.createRootId());
    redis.set('ping', 'pong', 10, () => {
      redis.batch([['get', 'ping']]).exec(() => {
        redis.multi([['get', 'ping']]).exec(() => {
          redis.get('ping', () => {
            const annotations = recorder.record.args.map(args => args[0]);
            const firstAnn = annotations[0];
            annotations.forEach(ann => {
              expect(ann.traceId.parentId).to.equal(firstAnn.traceId.traceId);
              expect(ann.traceId.traceId).to.equal(firstAnn.traceId.traceId);
              expect(ann.traceId.spanId).not.to.equal(firstAnn.traceId.traceId);
            });
            done();
          });
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
