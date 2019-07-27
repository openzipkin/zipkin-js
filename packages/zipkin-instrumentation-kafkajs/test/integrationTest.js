const {expect} = require('chai');
require('promise.prototype.finally').shim();

const {Kafka} = require('kafkajs');
const instrumentKafkaJs = require('../src/zipkin-instrumentation-kafkajs');

// In order to verify Kafka headers, which have buffer values
const {bufferToAscii} = require('../src/kafka-recorder');
const {expectB3Headers, setupTestTracer} = require('../../../test/testFixture');

describe('KafkaJS instrumentation - integration test', function() { // => doesn't allow this.X
  this.slow(15 * 1000);
  this.timeout(30 * 1000);

  const serviceName = 'weather-app';
  const remoteServiceName = 'kafka';

  const tracer = setupTestTracer({localServiceName: serviceName});

  let rawKafka;
  let kafka;
  let testTopic;
  let testMessage;

  function newKafka() {
    return new Kafka({clientId: serviceName, brokers: ['localhost:9092']});
  }

  before(() => {
    rawKafka = newKafka();
    kafka = instrumentKafkaJs(newKafka(), {tracer: tracer.tracer(), remoteServiceName});
    testMessage = {key: 'mykey', value: 'myvalue'};
  });

  beforeEach(function() { // => doesn't allow this.X
    testTopic = this.test.ctx.currentTest.title.replace(/\s+/g, '-').toLowerCase();
  });

  function send(producer) {
    return producer.connect()
      .then(() => producer.send({topic: testTopic, messages: [testMessage]}))
      .finally(() => producer.disconnect());
  }

  describe('Producer', () => {
    it('should record a producer span on send', () => send(kafka.producer())
      .then(() => tracer.expectNextSpanToEqual({
        kind: 'PRODUCER',
        name: 'send',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'kafka.topic': testTopic
          // TODO: we also tag kafka.key
        }
      })));

    it('should add B3 headers to the message on send', (done) => {
      const producer = kafka.producer();
      const consumer = rawKafka.consumer({groupId: testTopic});

      send(producer)
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
                expectB3Headers(tracer.popSpan(), headers, false);
                done();
              }).catch(err => done(err));
            }, 0);
            return Promise.resolve(); // TODO: why do we return a resolved promise here?
          }
        }))
        .catch(err => done(err));
    });
  });

  describe('Consumer', () => {
    it('should record a consumer span on eachMessage', (done) => {
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: testTopic});

      send(producer)
        .then(() => consumer.connect())
        .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => consumer.run({
          eachMessage: ({partition}) => {
            setTimeout(() => {
              consumer.disconnect().then(() => {
                tracer.expectNextSpanToEqual({
                  kind: 'CONSUMER', // TODO: this should be a child of the consumer span
                  name: 'each-message',
                  localEndpoint: {serviceName},
                  remoteEndpoint: {serviceName: remoteServiceName},
                  tags: {
                    'kafka.partition': partition.toString(), // NOTE: isn't tagged in brave
                    'kafka.topic': testTopic
                  }
                });
                done();
              }).catch(err => done(err));
            }, 0);
            return Promise.resolve();
          }
        }))
        .catch(err => done(err));
    });

    it('should resume trace from headers', (done) => {
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

      send(producer)
        .then(() => consumer.connect())
        .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => consumer.run({
          eachMessage: ({partition}) => {
            setTimeout(() => {
              consumer.disconnect().then(() => {
                const span = tracer.expectNextSpanToEqual({
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

                expect(span.traceId).to.equal(traceId);
                expect(span.id).to.not.equal(producerSpanId);
                done();
              }).catch(err => done(err));
            }, 0);
            return Promise.resolve();
          }
        }))
        .catch(err => done(err));
    });

    it('should tag a consumer span with error', (done) => {
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: testTopic});

      const verifyErrorSpan = () => {
        tracer.expectNextSpanToEqual({
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

      send(producer)
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
                    done();
                  }
                }).catch((err) => {
                  if (isError) {
                    done(err);
                  }
                });
              }, 0);

              if (isError) {
                errorCount += 1;
                return Promise.reject();
              }
              return Promise.resolve();
            }
          });
        })
        .catch(err => done(err));
    });
  });
});
