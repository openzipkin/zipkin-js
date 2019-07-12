# Zipkin-transport-kafka

![npm](https://img.shields.io/npm/dm/zipkin-transport-kafka.svg)

This is a module that sends Zipkin trace data from zipkin-js to Kafka.

## Usage

`npm install zipkin-transport-kafka --save`

```javascript
const {
  Tracer,
  BatchRecorder,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const {KafkaLogger} = require('zipkin-transport-kafka');
const noop = require('noop-logger');

const kafkaRecorder = new BatchRecorder({
  logger: new KafkaLogger({
    clientOpts: {
      connectionString: 'localhost:2181'
    },
    encoder: JSON_V2, // optional (defaults to THRIFT)
    log: noop // optional (defaults to console)
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl, // this would typically be a CLSContext or ExplicitContext
  localServiceName: 'service-a' // name of this application
});
```

If you do not use zookeeper to store offsets, use `clientOpts.kafkaHost` instead of `clientOpts.connectionString`.

```js
const {BatchRecorder} = require('zipkin');
const {KafkaLogger} = require('zipkin-transport-kafka');

const kafkaRecorder = new BatchRecorder({
  logger: new KafkaLogger({
    clientOpts: {
      kafkaHost: 'localhost:2181'
    }
  })
});
```
