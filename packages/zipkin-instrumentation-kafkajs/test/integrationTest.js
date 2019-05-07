require('promise.prototype.finally').shim();
const {Tracer} = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const {Kafka} = require('kafkajs');
const instrumentKafkaJs = require('../src/zipkin-instrumentation-kafkajs');
const sinon = require('sinon');

describe('Kafka js intrumentation test', () => {
  const localServiceName = 'node-backend';
  const remoteServiceName = 'consumer-backend';

  let record;
  let recorder;
  let ctxImpl;
  let tracer;
  let kafka;

  beforeEach(() => {
    record = sinon.spy();
    recorder = {record};
    ctxImpl = new CLSContext('zipkin-test');
    tracer = new Tracer({recorder, ctxImpl, localServiceName});
    kafka = instrumentKafkaJs(new Kafka({
      clientId: 'test-app',
      brokers: ['localhost:9092']
    }), {tracer, remoteServiceName});
  });

  function verifyProduce(annotations, topic, isError) {
    let i = 0;
    expect(annotations[i].annotation.annotationType).to.equal('ServiceName');
    expect(annotations[i++].annotation.serviceName).to.equal(remoteServiceName);
    expect(annotations[i].annotation.annotationType).to.equal('Rpc');
    expect(annotations[i++].annotation.name).to.equal('produce');
    expect(annotations[i].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[i].annotation.key).to.equal('kafka.topic');
    expect(annotations[i++].annotation.value).to.equal(topic);
    expect(annotations[i++].annotation.annotationType).to.equal('ProducerStart');
    expect(annotations[i++].annotation.annotationType).to.equal('ServerAddr');
    if (isError) {
      expect(annotations[i++].annotation.key).to.equal('error');
    }
    expect(annotations[i++].annotation.annotationType).to.equal('ProducerStop');
    return annotations.slice(i);
  }

  function verifyConsume(annotations, topic, partition, isError) {
    const splicedAnnotations = verifyProduce(annotations, topic);
    let i = 0;
    expect(splicedAnnotations[i].annotation.annotationType).to.equal('ServiceName');
    expect(splicedAnnotations[i++].annotation.serviceName).to.equal(localServiceName);
    expect(splicedAnnotations[i].annotation.annotationType).to.equal('Rpc');
    expect(splicedAnnotations[i++].annotation.name).to.equal('consume');
    expect(splicedAnnotations[i].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(splicedAnnotations[i].annotation.key).to.equal('kafka.topic');
    expect(splicedAnnotations[i++].annotation.value).to.equal(topic);
    expect(splicedAnnotations[i].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(splicedAnnotations[i].annotation.key).to.equal('kafka.partition');
    expect(splicedAnnotations[i++].annotation.value).to.equal(partition);
    expect(splicedAnnotations[i++].annotation.annotationType).to.equal('ConsumerStart');
    if (isError) {
      expect(splicedAnnotations[i++].annotation.key).to.equal('error');
    }
    expect(splicedAnnotations[i++].annotation.annotationType).to.equal('ConsumerStop');
  }

  it('producer-should-be-instumented', function() {
    this.slow(15 * 1000);
    this.timeout(30 * 1000);
    const topic = this.test.title;
    const producer = kafka.producer();

    return producer.connect().then(() =>
      producer.send({
        topic,
        messages: [{key: 'test', value: 'test'}]
      }).then(() => {
        const annotations = record.args.map(args => args[0]);
        verifyProduce(annotations, topic);
      }).finally(() => producer.disconnect())
    );
  });

  it('consumer-should-be-instumented', function(done) {
    this.slow(15 * 1000);
    this.timeout(30 * 1000);
    const testTopic = this.test.title;
    const producer = kafka.producer();
    const consumer = kafka.consumer({groupId: 'test-group'});

    producer.connect().then(() =>
      producer.send({
        topic: testTopic,
        messages: [{key: 'test', value: 'test'}]
      })
      .finally(() => producer.disconnect())
      .finally(
         consumer.connect()
         .then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
         .then(() =>
           consumer.run({
             eachMessage: ({topic, partition}) => {
               setTimeout(() => {
                 consumer.disconnect().then(() => {
                   const annotations = record.args.map(args => args[0]);
                   verifyConsume(annotations, topic, partition);
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

  it('consumer-error-should-be-instumented', function(done) {
    this.slow(15 * 1000);
    this.timeout(30 * 1000);
    const testTopic = this.test.title;
    const producer = kafka.producer();
    const consumer = kafka.consumer({groupId: 'test-group'});

    producer.connect().then(() =>
      producer.send({topic: testTopic, messages: [{key: 'test', value: 'test'}]})
      .finally(() => producer.disconnect())
      .finally(
        consumer.connect().then(() => consumer.subscribe({topic: testTopic, fromBeginning: true}))
        .then(() => {
          let errorCount = 0;
          return consumer.run({
            eachMessage: ({topic, partition}) => {
              const isError = errorCount === 0;
              setTimeout(() => {
                consumer.disconnect().then(() => {
                  if (isError) {
                    const annotations = record.args.map(args => args[0]);
                    verifyConsume(annotations, topic, partition, isError);
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
