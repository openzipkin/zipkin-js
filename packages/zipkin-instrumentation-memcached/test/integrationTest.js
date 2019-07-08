const {ExplicitContext, Tracer} = require('zipkin');
const Memcached = require('memcached');
const {newSpanRecorder, expectSpan} = require('../../../test/testFixture');

const zipkinClient = require('../src/zipkinClient');

// This instrumentation records metadata, but does not affect memcached requests otherwise. Hence,
// these tests do not expect B3 headers.
describe('memcached instrumentation (integration test)', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  let spans;
  let tracer;

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({
      localServiceName: serviceName,
      ctxImpl: new ExplicitContext(),
      recorder: newSpanRecorder(spans)
    });
  });

  // TODO: pull into http tests also
  afterEach(() => expect(spans).to.be.empty);

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function clientSpan(name, tags) {
    return ({
      name,
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName},
      tags
    });
  }

  function getClient(host = process.env.MEMCACHED_HOST || 'localhost:11211') {
    return new (zipkinClient(tracer, Memcached, serviceName, remoteServiceName))(host, {
      timeout: 1000,
      idle: 1000,
      failures: 0,
      retries: 0,
      poolsize: 1
    });
  }

  it('should record successful request', done => getClient().set('ping', 'pong', 10, (err) => {
    if (err) return done(err);

    expectSpan(popSpan(), clientSpan('set', {'memcached.key': 'ping'}));
    return done();
  }));

  it('should report error in tags on transport error', done => getClient('localhost:12345').set('scooby', 'doo', 10, (err, data) => {
    if (!err) return done(new Error(`expected response to error: ${data}`));

    expectSpan(popSpan(), clientSpan('set', {
      'memcached.key': 'scooby',
      error: 'connect ECONNREFUSED 127.0.0.1:12345'
    }));
    return done();
  }));

  it('should handle nested requests', (done) => {
    const memcached = getClient();
    memcached.set('foo', 'bar', 10, (err) => {
      if (err) return done(err);

      expectSpan(popSpan(), clientSpan('set', {'memcached.key': 'foo'}));
      return memcached.getMulti(['foo', 'fox'], (err2, data) => {
        if (err2) return done(err2);

        expect(data).to.deep.equal({foo: 'bar'});
        expectSpan(popSpan(), clientSpan('get-multi', {'memcached.keys': 'foo,fox'}));
        return done();
      });
    });
  });

  // TODO: add to all client tests
  it('should restore original trace ID', (done) => {
    const rootId = tracer.createRootId();
    tracer.setId(rootId);

    getClient().set('scooby', 'doo', 10, (err) => {
      if (err) return done(err);

      // the recorded span is a child of the original
      expect(tracer.id.spanId).to.equal(popSpan().parentId);

      // the original span ID is now current
      expect(tracer.id.traceId).to.equal(rootId.traceId);
      return done();
    });
  });
});
