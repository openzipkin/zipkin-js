# Zipkin-transport-kafka

This is a module that sends Zipkin trace data from zipkin-js to Kafka.

## Usage:

`npm install zipkin-transport-kafka --save`

```javascript
const {Tracer, BatchRecorder} = require('zipkin');
const {KafkaLogger} = require('zipkin-transport-kafka');

const kafkaRecorder = new BatchRecorder({
  logger: new KafkaLogger({
    clientOpts: {
      connectionString: 'localhost:2181'
    }
  })
});

const tracer = new Tracer({
  recorder: kafkaRecorder,
  ctxImpl // this would typically be a CLSContext or ExplicitContext
});
```
