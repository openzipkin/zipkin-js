# zipkin-instrumentation-kafkajs

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-kafkajs.svg)

Zipkin instrumentation for [KafkaJS](https://kafka.js.org) producer and consumer.

### Requirements

The solution uses kafka message headers to propagate tracing context and as such requires Kafka version 0.11+

### Limitations

Currently only single message handling is traced, batch message handling is not yet supported.
This means you need to use the consumer's `eachMessage` method for consuming messages and the
producer's `send` method.

Error reporting is supported but you need to make sure your consumer or producer does not infinitely
retry (perhaps pauses the consumer for a while) when exception is encountered otherwise you will keep receiving new error spans.

### Usage

```javascript
const instrumentKafkaJs = require('zipkin-instrumentation-kafkajs');

const kafka = instrumentKafkaJs(new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092']
}), {
    tracer, // Your zipkin tracer instance
    remoteServiceName : 'kafka' // This should be the symbolic name of the broker, not a consumer.
});

//Use KafkaJS as usual, single message handling will use tracing
const consumer = kafka.consumer({ groupId: 'test-group' });
consumer.connect();
consumer.subscribe({ topic: 'hello' });
consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    console.log(message.value.toString());
  }
});

const producer = kafka.producer();
producer.connect();
producer.send({
  topic: 'topic-name',
  messages: [{ key: 'key1', value: 'hello world' }]
});
```
