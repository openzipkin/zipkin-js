const redis = require('redis');
const zipkinClient = require('../src/zipkinClient');

const {setupTestTracer} = require('../../../test/testFixture');

// This instrumentation records metadata, but does not affect redis requests otherwise. Hence,
// these tests do not expect B3 headers.
describe('redis instrumentation (integration test)', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const tracer = setupTestTracer({localServiceName: serviceName});

  function clientSpan(name, tags) {
    const result = {
      name,
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {
        port: '6379',
        serviceName: remoteServiceName
      },
    };
    if (tags) result.tags = tags;
    return result;
  }

  function getClient(done, options = {expectSuccess: true}) {
    const host = options.host || 'localhost:6379';
    const result = zipkinClient(tracer.tracer(), redis, {
      host: host.split(':')[0],
      port: host.split(':')[1],
    }, serviceName, remoteServiceName);
    if (options.expectSuccess) result.on('error', err => done(err));
    return result;
  }

  it('should record successful request', done => getClient(done).set('ping', 'pong', () => {
    tracer.expectNextSpanToEqual(clientSpan('set'));
    done();
  }));

  it('should record successful batch request', done => getClient(done)
    .batch([['get', 'ping'], ['set', 'syn', 'ack']]).exec(() => {
      // TODO: should this span be named exec?
      tracer.expectNextSpanToEqual(clientSpan('exec', {commands: '["get","set"]'}));
      done();
    }));

  it('should report error in tags', done => getClient(done, {expectSuccess: false})
    .get('ping', 'pong', (err, data) => {
      if (!err) {
        done(new Error(`expected response to error: ${data}`));
      } else {
        tracer.expectNextSpanToEqual(clientSpan('get', {
          error: 'ERR wrong number of arguments for \'get\' command'
        }));
        done();
      }
    }));

  it('should handle nested requests', (done) => {
    const client = getClient(done);
    client.set('foo', 'bar', () => {
      tracer.expectNextSpanToEqual(clientSpan('set'));

      client.get('foo', (err, data) => {
        tracer.expectNextSpanToEqual(clientSpan('get'));
        expect(data).to.deep.equal('bar');
        done();
      });
    });
  });
});
