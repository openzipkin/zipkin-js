/* eslint-disable no-console */
const kafka = require('kafka-node');
const THRIFT = require('zipkin-encoder-thrift');
const {
  Annotation, BatchRecorder, jsonEncoder: {JSON_V2}, option, TraceId
} = require('zipkin');
const makeKafkaServer = require('kafka-please');
const KafkaLogger = require('../src/KafkaLogger');

function waitPromise(length) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, length);
  });
}

const traceId = new TraceId({
  traceId: '5c7d31940cb80828',
  spanId: 'cb37670e772e86e2',
  sampled: new option.Some(true)
});

function record(timestamp, annotation) { // tracer.Record is not exported, so we fake it
  return {traceId, timestamp, annotation};
}

function createSpan(recorder) {
  recorder.record(record(1, new Annotation.ServiceName('my-service')));
  recorder.record(record(1, new Annotation.Rpc('GET')));
  recorder.record(record(1, new Annotation.BinaryAnnotation('http.path', '/api')));
  recorder.record(record(1, new Annotation.ServerRecv()));
  recorder.record(record(3, new Annotation.BinaryAnnotation('http.status_code', '200')));
  recorder.record(record(3, new Annotation.ServerSend()));
}

function verifyThrift(message) {
  expect(message.value).to.contain('/api');
}

function verifyJsonV2(message) {
  // verifies this is a singleton list message in v2 format
  expect(JSON.parse(message.value)).to.deep.equal([{
    traceId: traceId.traceId,
    id: traceId.spanId,
    name: 'get',
    kind: 'SERVER',
    timestamp: 1,
    duration: 2,
    localEndpoint: {serviceName: 'my-service'},
    tags: {
      'http.path': '/api',
      'http.status_code': '200'
    }
  }]);
}

describe('Kafka transport - integration test', () => {
  function shouldSendTraceDataToKafka(encoder, verifySerialized, done) {
    makeKafkaServer().then((kafkaServer) => {
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
          return client
            ? new Promise(resolve => client.close(resolve))
            : Promise.resolve();
        };

        const closeKafkaLogger = () => {
          return kafkaLogger
            ? kafkaLogger.close()
            : Promise.resolve();
        };

        closeKafkaLogger()
          .then(closeProducerClient())
          .then(closeClient())
          .then(() => kafkaServer.close()
            .then(() => done(arg)));
      }

      return new Promise((resolve) => {
        console.log('creating topic...');
        producer.on('ready', () => {
          producer.createTopics(['zipkin'], true, (err) => {
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
        consumer.on('message', (message) => {
          console.log('Received Zipkin data from Kafka');
          expect(message.topic).to.equal('zipkin');
          verifySerialized(message);
          consumer.close(true, finish);
        });

        client.on('error', (err) => {
          console.log('client error', err);
          finish(err);
        });
        consumer.on('error', (err) => {
          console.log('consumer error', err);
          consumer.close(true, () => finish(err));
        });

        kafkaLogger = new KafkaLogger({
          encoder,
          clientOpts: {
            connectionString: `localhost:${kafkaServer.zookeeperPort}`
          }
        });

        createSpan(new BatchRecorder({logger: kafkaLogger}));
      });
    }).catch((err) => {
      console.error('Big err', err);
      done(err);
    });
  }

  it('should send trace data to Kafka: THRIFT', function(done) {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);

    shouldSendTraceDataToKafka(THRIFT, verifyThrift, done);
  });

  it('should send trace data to Kafka: JSON_V2', function(done) {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);

    shouldSendTraceDataToKafka(JSON_V2, verifyJsonV2, done);
  });

  it('should send trace data to Kafka without zookeeper', function(done) {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);

    makeKafkaServer().then((kafkaServer) => {
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
          return client
            ? new Promise(resolve => client.close(resolve))
            : Promise.resolve();
        };

        const closeKafkaLogger = () => {
          return kafkaLogger
            ? kafkaLogger.close()
            : Promise.resolve();
        };

        closeKafkaLogger()
          .then(closeProducerClient())
          .then(closeClient())
          .then(() => kafkaServer.close()
            .then(() => done(arg)));
      }

      return new Promise((resolve) => {
        console.log('creating topic...');
        producer.on('ready', () => {
          producer.createTopics(['zipkin'], true, (err) => {
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
        consumer.on('message', (message) => {
          console.log('Received Zipkin data from Kafka');
          expect(message.topic).to.equal('zipkin');
          verifyThrift(message);
          consumer.close(true, finish);
        });

        client.on('error', (err) => {
          console.log('client error', err);
          finish(err);
        });
        consumer.on('error', (err) => {
          console.log('consumer error', err);
          consumer.close(true, () => finish(err));
        });

        kafkaLogger = new KafkaLogger({
          clientOpts: {
            kafkaHost: `localhost:${kafkaServer.kafkaPort}`
          }
        });

        createSpan(new BatchRecorder({logger: kafkaLogger}));
      });
    }).catch((err) => {
      console.error('Big err', err);
      done(err);
    });
  });
});
