require('promise.prototype.finally').shim();
const {expect} = require('chai');
const {
  newSpanRecorder,
  expectB3Headers,
  expectSpan
} = require('../../../test/testFixture');
const {ExplicitContext, Tracer} = require('zipkin');

// In order to verify Kafka headers, which have buffer values
const {bufferToAscii} = require('../src/kafka-recorder');

const {Kafka} = require('kafkajs');
const instrumentKafkaJs = require('../src/zipkin-instrumentation-kafkajs');

describe('KafkaJS instrumentation - integration test', function() { // => doesn't allow this.X
  this.slow(15 * 1000);
  this.timeout(30 * 1000);

  const serviceName = 'weather-app';
  const remoteServiceName = 'kafka';

  let spans;
  let tracer;
  let rawKafka;
  let kafka;
  let testMessage;

  function newKafka() {
    return new Kafka({clientId: serviceName, brokers: ['localhost:9092']});
  }

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({
      localServiceName: serviceName,
      ctxImpl: new ExplicitContext(),
      recorder: newSpanRecorder(spans)
    });
    rawKafka = newKafka();
    kafka = instrumentKafkaJs(newKafka(), {tracer, remoteServiceName});
    testMessage = {key: 'mykey', value: 'myvalue'};
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function getTestTopic(ref) {
    return ref.test.title.replace(/\s+/g, '-').toLowerCase();
  }

  function send(producer, topic, message) {
    return producer.connect()
      .then(() => producer.send({topic, messages: [message]}))
      .finally(() => producer.disconnect());
  }

  describe('Producer', () => {
    it('should record a producer span on send', function() { // => doesn't allow this.X
      const testTopic = getTestTopic(this);

      return send(kafka.producer(), testTopic, testMessage).then(() => {
        expectSpan(popSpan(), {
          kind: 'PRODUCER',
          name: 'send',
          localEndpoint: {serviceName},
          remoteEndpoint: {serviceName: remoteServiceName},
          tags: {
            'kafka.topic': testTopic
            // TODO: we also tag kafka.key
          }
        });
        expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
      });
    });

    it('should add B3 headers to the message on send', function(done) { // => doesn't allow this.X
      const testTopic = getTestTopic(this);
      const producer = kafka.producer();
      const consumer = rawKafka.consumer({groupId: testTopic});

      send(producer, testTopic, testMessage)
        .then(() => consumer.connect())
        .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => consumer.run({
          eachMessage: ({message}) => {
            setTimeout(() => { // TODO: what does the timeout of zero provide?
              consumer.disconnect().then(() => { // TODO: why disconnect before reading?
                // Kafka header values are buffers, but our assertions work on strings
                const headers = Object.assign({}, ...Array.from(
                  Object.entries(message.headers),
                  ([k, buffer]) => ({[k]: bufferToAscii(buffer)})
                ));
                expectB3Headers(popSpan(), headers, false);
                done();
              }).catch((err) => done(err));
            }, 0);
            return Promise.resolve(); // TODO: why do we return a resolved promise here?
          }
        }))
        .catch((err) => done(err));
    });
  });

  describe('Consumer', () => {
    it('should record a consumer span on eachMessage', function(done) { // => doesn't allow this.X
      const testTopic = getTestTopic(this);
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: testTopic});

      send(producer, testTopic, testMessage)
        .then(() => consumer.connect())
        .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => consumer.run({
          eachMessage: ({partition}) => {
            setTimeout(() => {
              consumer.disconnect().then(() => {
                expectSpan(popSpan(), {
                  kind: 'CONSUMER', // TODO: this should be a child of the consumer span
                  name: 'each-message',
                  localEndpoint: {serviceName},
                  remoteEndpoint: {serviceName: remoteServiceName},
                  tags: {
                    'kafka.partition': partition.toString(), // NOTE: isn't tagged in brave
                    'kafka.topic': testTopic
                  }
                });
                expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
                done();
              }).catch((err) => done(err));
            }, 0);
            return Promise.resolve();
          }
        }))
        .catch((err) => done(err));
    });

    it('should resume trace from headers', function(done) { // => doesn't allow this.X
      const testTopic = getTestTopic(this);
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: testTopic});

      const traceId = '000000000000162e';
      const producerSpanId = '000000000000abcd';
      testMessage = {
        key: 'mykey',
        value: 'myvalue',
        headers: {
          'X-B3-TraceId': traceId,
          'X-B3-SpanId': producerSpanId,
          'X-B3-Sampled': '1'
        }
      };

      send(producer, testTopic, testMessage)
        .then(() => consumer.connect())
        .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => consumer.run({
          eachMessage: ({partition}) => {
            setTimeout(() => {
              consumer.disconnect().then(() => {
                const span = popSpan();
                expect(span.traceId).to.equal(traceId);
                expect(span.id).to.not.equal(producerSpanId);
                expectSpan(span, {
                  parentId: producerSpanId,
                  kind: 'CONSUMER', // TODO: should be a child of the consumer span
                  name: 'each-message',
                  localEndpoint: {serviceName},
                  remoteEndpoint: {serviceName: remoteServiceName},
                  tags: {
                    'kafka.partition': partition.toString(), // NOTE: isn't tagged in brave
                    'kafka.topic': testTopic
                  },
                });
                expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
                done();
              }).catch((err) => done(err));
            }, 0);
            return Promise.resolve();
          }
        }))
        .catch((err) => done(err));
    });

    it('should tag a consumer span with error', function(done) { // => doesn't allow this.X
      const testTopic = getTestTopic(this);
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: testTopic});

      const verifyErrorSpan = () => {
        expectSpan(popSpan(), {
          kind: 'CONSUMER', // TODO: this should be a child of the consumer span
          name: 'each-message',
          localEndpoint: {serviceName},
          remoteEndpoint: {serviceName: remoteServiceName},
          tags: {
            error: '', // TODO: for some reason the actual cause isn't propagated
            'kafka.partition': '0', // NOTE: this isn't tagged in brave
            'kafka.topic': testTopic
          }
        });
      };

      send(producer, testTopic, testMessage)
        .then(() => consumer.connect())
        .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => {
          let errorCount = 0;
          return consumer.run({
            eachMessage: () => {
              const isError = errorCount === 0;
              setTimeout(() => {
                consumer.disconnect().then(() => {
                  if (isError) {
                    verifyErrorSpan();
                    expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
                    done();
                  }
                }).catch((err) => {
                  if (isError) {
                    done(err);
                  }
                });
              }, 0);

              if (isError) {
                errorCount++;
                return Promise.reject();
              }
              return Promise.resolve();
            }
          });
        })
        .catch((err) => done(err));
    });
  });
});
