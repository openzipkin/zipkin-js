const Memcached = require('memcached');
const zipkinClient = require('../src/zipkinClient');

const {setupTestTracer} = require('../../../test/testFixture');

// This instrumentation records metadata, but does not affect memcached requests otherwise. Hence,
// these tests do not expect B3 headers.
describe('memcached instrumentation (integration test)', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const tracer = setupTestTracer({localServiceName: serviceName});

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
    return new (zipkinClient(tracer.tracer(), Memcached, serviceName, remoteServiceName))(host, {
      timeout: 1000,
      idle: 1000,
      failures: 0,
      retries: 0,
      poolsize: 1
    });
  }

  it('should record successful request', done => getClient().set('ping', 'pong', 10, (err) => {
    if (err) return done(err);

    tracer.expectNextSpanToEqual(clientSpan('set', {'memcached.key': 'ping'}));
    return done();
  }));

  it('should report error in tags on transport error', done => getClient('localhost:12345')
    .set('scooby', 'doo', 10, (err, data) => {
      if (!err) return done(new Error(`expected response to error: ${data}`));

      tracer.expectNextSpanToEqual(clientSpan('set', {
        'memcached.key': 'scooby',
        error: 'connect ECONNREFUSED 127.0.0.1:12345'
      }));
      return done();
    }));

  it('should handle nested requests', (done) => {
    const memcached = getClient();
    memcached.set('foo', 'bar', 10, (err) => {
      if (err) return done(err);

      tracer.expectNextSpanToEqual(clientSpan('set', {'memcached.key': 'foo'}));
      return memcached.getMulti(['foo', 'fox'], (err2, data) => {
        if (err2) return done(err2);

        expect(data).to.deep.equal({foo: 'bar'});
        tracer.expectNextSpanToEqual(clientSpan('get-multi', {'memcached.keys': 'foo,fox'}));
        return done();
      });
    });
  });
});
