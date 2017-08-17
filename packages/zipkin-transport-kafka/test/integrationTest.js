/* eslint-disable no-console */
const kafka = require('kafka-node');
const {Tracer, BatchRecorder, Annotation, ExplicitContext} = require('zipkin');
const KafkaLogger = require('../src/KafkaLogger');
const makeKafkaServer = require('kafka-please');

function waitPromise(length) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, length);
  });
}

describe('Kafka transport - integration test', () => {
  it('should send trace data to Kafka', function(done) {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);

    makeKafkaServer().then(kafkaServer => {
      const producerClient = new kafka.Client(
        `localhost:${kafkaServer.zookeeperPort}`,
        'zipkin-integration-test-producer'
      );
      const producer = new kafka.Producer(producerClient);
      let client;
      let kafkaLogger;
      function finish(arg) {
        /* eslint-disable arrow-body-style */

        const closeProducerClient = () => new Promise(resolve => producerClient.close(resolve));
        const closeClient = () => {
          return client ?
            new Promise(resolve => client.close(resolve))
            : Promise.resolve();
        };

        const closeKafkaLogger = () => {
          return kafkaLogger ?
            kafkaLogger.close() :
            Promise.resolve();
        };

        closeKafkaLogger()
          .then(closeProducerClient())
          .then(closeClient())
          .then(() => kafkaServer.close()
            .then(() => done(arg)));
      }

      return new Promise(resolve => {
        console.log('creating topic...');
        producer.on('ready', () => {
          producer.createTopics(['zipkin'], true, err => {
            if (err) {
              finish(err);
            } else {
              console.log('topic was created');
              resolve();
            }
          });
        });
      }).then(() => waitPromise(1000)).then(() => {
        client = new kafka.Client(
          `localhost:${kafkaServer.zookeeperPort}`,
          'zipkin-integration-test-consumer'
        );
        const consumer = new kafka.HighLevelConsumer(
          client,
          [{topic: 'zipkin'}],
          {
            groupId: 'zipkin'
          }
        );
        consumer.on('message', message => {
          console.log('Received Zipkin data from Kafka');
          expect(message.topic).to.equal('zipkin');
          expect(message.value).to.contain('http://example.com');
          consumer.close(true, finish);
        });

        client.on('error', err => {
          console.log('client error', err);
          finish(err);
        });
        consumer.on('error', err => {
          console.log('consumer error', err);
          consumer.close(true, () => finish(err));
        });

        kafkaLogger = new KafkaLogger({
          clientOpts: {
            connectionString: `localhost:${kafkaServer.zookeeperPort}`
          }
        });

        const ctxImpl = new ExplicitContext();
        const recorder = new BatchRecorder({logger: kafkaLogger});
        const tracer = new Tracer({recorder, ctxImpl});

        ctxImpl.scoped(() => {
          tracer.recordAnnotation(new Annotation.ServerRecv());
          tracer.recordServiceName('my-service');
          tracer.recordRpc('GET');
          tracer.recordBinary('http.url', 'http://example.com');
          tracer.recordBinary('http.response_code', '200');
          tracer.recordAnnotation(new Annotation.ServerSend());
        });
      });
    }).catch(err => {
      console.error('Big err', err);
      done(err);
    });
  });

  it('should send trace data to Kafka without zookeeper', function(done) {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);

    makeKafkaServer().then(kafkaServer => {
      const producerClient = new kafka.Client(
        `localhost:${kafkaServer.zookeeperPort}`,
        'zipkin-integration-test-producer'
      );
      const producer = new kafka.Producer(producerClient);
      let client;
      let kafkaLogger;
      function finish(arg) {
        /* eslint-disable arrow-body-style */

        const closeProducerClient = () => new Promise(resolve => producerClient.close(resolve));
        const closeClient = () => {
          return client ?
            new Promise(resolve => client.close(resolve))
            : Promise.resolve();
        };

        const closeKafkaLogger = () => {
          return kafkaLogger ?
            kafkaLogger.close() :
            Promise.resolve();
        };

        closeKafkaLogger()
          .then(closeProducerClient())
          .then(closeClient())
          .then(() => kafkaServer.close()
            .then(() => done(arg)));
      }

      return new Promise(resolve => {
        console.log('creating topic...');
        producer.on('ready', () => {
          producer.createTopics(['zipkin'], true, err => {
            if (err) {
              finish(err);
            } else {
              console.log('topic was created');
              resolve();
            }
          });
        });
      }).then(() => waitPromise(1000)).then(() => {
        client = new kafka.Client(
          `localhost:${kafkaServer.zookeeperPort}`,
          'zipkin-integration-test-consumer'
        );
        const consumer = new kafka.HighLevelConsumer(
          client,
          [{topic: 'zipkin'}],
          {
            groupId: 'zipkin'
          }
        );
        consumer.on('message', message => {
          console.log('Received Zipkin data from Kafka');
          expect(message.topic).to.equal('zipkin');
          expect(message.value).to.contain('http://example.com');
          consumer.close(true, finish);
        });

        client.on('error', err => {
          console.log('client error', err);
          finish(err);
        });
        consumer.on('error', err => {
          console.log('consumer error', err);
          consumer.close(true, () => finish(err));
        });

        kafkaLogger = new KafkaLogger({
          clientOpts: {
            kafkaHost: `localhost:${kafkaServer.kafkaPort}`
          }
        });

        const ctxImpl = new ExplicitContext();
        const recorder = new BatchRecorder({logger: kafkaLogger});
        const tracer = new Tracer({recorder, ctxImpl});

        ctxImpl.scoped(() => {
          tracer.recordAnnotation(new Annotation.ServerRecv());
          tracer.recordServiceName('my-service');
          tracer.recordRpc('GET');
          tracer.recordBinary('http.url', 'http://example.com');
          tracer.recordBinary('http.response_code', '200');
          tracer.recordAnnotation(new Annotation.ServerSend());
        });
      });
    }).catch(err => {
      console.error('Big err', err);
      done(err);
    });
  });
});
