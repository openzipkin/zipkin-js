const {newSpanRecorder, expectSpan} = require('../../../test/testFixture');
const {ExplicitContext, Tracer} = require('zipkin');

const zipkinClient = require('../src/zipkinClient');
const redis = require('redis');

// This instrumentation records metadata, but does not affect redis requests otherwise. Hence,
// these tests do not expect B3 headers.
describe('redis instrumentation (integration test)', () => {
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
    const result = zipkinClient(tracer, redis, {
      host: host.split(':')[0],
      port: host.split(':')[1],
    }, serviceName, remoteServiceName);
    if (options.expectSuccess) result.on('error', err => done(err));
    return result;
  }

  it('should record successful request', done =>
    getClient(done).set('ping', 'pong', () => {
      expectSpan(popSpan(), clientSpan('set'));
      done();
    })
  );

  it('should record successful batch request', done =>
    getClient(done).batch([['get', 'ping'], ['set', 'syn', 'ack']]).exec(() => {
      // TODO: should this span be named exec?
      expectSpan(popSpan(), clientSpan('exec', {commands: '["get","set"]'}));
      done();
    })
  );

  it('should report error in tags', done =>
    getClient(done, {expectSuccess: false}).get('ping', 'pong', (err, data) => {
      if (!err) {
        done(new Error(`expected response to error: ${data}`));
      } else {
        expectSpan(popSpan(), clientSpan('get', {
          error: 'ERR wrong number of arguments for \'get\' command'
        }));
        done();
      }
    })
  );

  it('should handle nested requests', done => {
    const client = getClient(done);
    client.set('foo', 'bar', () => {
      expectSpan(popSpan(), clientSpan('set'));

      client.get('foo', (err, data) => {
        expectSpan(popSpan(), clientSpan('get'));
        expect(data).to.deep.equal('bar');
        done();
      });
    });
  });

  // TODO: add to all client tests
  it('should restore original trace ID', done => {
    const rootId = tracer.createRootId();
    tracer.setId(rootId);

    getClient(done).set('scooby', 'doo', () => {
      // the recorded span is a child of the original
      expect(tracer.id.spanId).to.equal(popSpan().parentId);

      // the original span ID is now current
      expect(tracer.id.traceId).to.equal(rootId.traceId);
      done();
    });
  });
});
