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
const _ = require('lodash');

const {Kafka} = require('kafkajs');
const instrumentKafkaJs = require('../src/zipkin-instrumentation-kafkajs');

describe('KafkaJS instrumentation - integration test', function() { // this.X doesn't work with =>
  this.slow(15 * 1000);
  this.timeout(30 * 1000);

  const serviceName = 'weather-app';
  const remoteServiceName = 'kafka';

  let spans;
  let tracer;
  let rawKafka;
  let kafka;

  function newKafka() {
    return new Kafka({clientId: serviceName, brokers: ['localhost:9092']});
  }

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({ctxImpl: new ExplicitContext(), recorder: newSpanRecorder(spans)});
    rawKafka = newKafka();
    kafka = instrumentKafkaJs(newKafka(), {tracer, remoteServiceName});
  });

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  describe('Producer', () => {
    it('should record a producer span on send', () => {
      const testTopic = 'producer-send';
      const producer = kafka.producer();

      return producer.connect().then(() =>
        producer.send({
          topic: testTopic,
          messages: [{key: 'mykey', value: 'myvalue'}]
        }).then(() => {
          expectSpan(popSpan(), {
            kind: 'PRODUCER',
            name: 'produce', // TODO: change to send!
            localEndpoint: {
              serviceName: remoteServiceName // TODO: bug!
            },
            remoteEndpoint: {
              serviceName: remoteServiceName
            },
            tags: {
              'kafka.topic': testTopic
              // TODO: we also tag kafka.key
            }
          });
          expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
        }).finally(() => producer.disconnect())
      );
    });

    it('should add B3 headers to the message on send', done => {
      const testTopic = 'consumer-eachMessage';
      const producer = kafka.producer();
      const consumer = rawKafka.consumer({groupId: 'test-group'});

      producer.connect().then(() => producer
        .send({topic: testTopic, messages: [{key: 'mykey', value: 'myvalue'}]})
        .finally(() => producer.disconnect())
        .finally(consumer.connect()
          .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
          .then(() => consumer.run({
            eachMessage: ({message}) => {
              setTimeout(() => {
                consumer.disconnect().then(() => {
                  const headers = _.mapValues(message.headers, bufferToAscii);
                  expectB3Headers(popSpan(), headers, false);
                  expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
                  done();
                }).catch((err) => done(err));
              }, 0);
              return Promise.resolve();
            }
          }))
        )
      )
      .catch((err) => done(err));
    });
  });

  describe('Consumer', () => {
    it('should record a consumer span on eachMessage', done => {
      const testTopic = 'consumer-eachMessage';
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: 'test-group'});

      producer.connect().then(() =>
        producer.send({topic: testTopic, messages: [{key: 'mykey', value: 'myvalue'}]})
        .finally(() => producer.disconnect())
        .finally(
           consumer.connect()
           .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
           .then(() =>
             consumer.run({
               eachMessage: ({partition}) => {
                 setTimeout(() => {
                   consumer.disconnect().then(() => {
                     expectSpan(popSpan(), {
                       kind: 'CONSUMER', // TODO: this should be a child of the consumer span
                       name: 'consume', // TODO: change to eachMessage!
                       localEndpoint: {
                         serviceName: 'unknown' // TODO: bug!
                       },
     //                  remoteEndpoint: { // TODO: we aren't tagging the remote endpoint
     //                    serviceName: remoteServiceName
     //                  },
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
             })
           )
         )
      )
      .catch((err) => done(err));
    });

    it('should tag a consumer span with error', done => {
      const testTopic = 'consumer-error';
      const producer = rawKafka.producer();
      const consumer = kafka.consumer({groupId: 'test-group'});

      const verifyErrorSpan = () => {
        expectSpan(popSpan(), {
          kind: 'CONSUMER', // TODO: this should be a child of the consumer span
          name: 'consume', // TODO: change to eachMessage!
          localEndpoint: {
            serviceName: 'unknown' // TODO: bug!
          },
  //                  remoteEndpoint: { // TODO: we aren't tagging the remote endpoint
  //                    serviceName: remoteServiceName
  //                  },
          tags: {
            error: 'unknown', // TODO: incorrect
            'kafka.partition': '0', // NOTE: this isn't tagged in brave
            'kafka.topic': testTopic
          }
        });
      };

      producer.connect().then(() => producer
        .send({topic: testTopic, messages: [{key: 'mykey', value: 'myvalue'}]})
        .finally(() => producer.disconnect())
        .finally(
          consumer.connect().then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
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
        )
      )
      .catch((err) => done(err));
    });
  });
});
