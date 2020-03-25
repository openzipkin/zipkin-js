# Zipkin-transport-aws-sqs

![npm](https://img.shields.io/npm/dm/zipkin-transport-aws-sqs.svg)

This is a module that sends Zipkin trace data from zipkin-js to AWS SQS.

## Usage

`npm install zipkin-transport-aws-sqs --save`

```javascript
const {
  Tracer,
  BatchRecorder,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const {AwsSqsLogger} = require('zipkin-transport-aws-sqs');
const noop = require('noop-logger');

const AwsSqsRecorder = new BatchRecorder({
  logger: new AwsSqsLogger({
    queueUrl: "https://...", //mandatory
    awsConfig: {
      credentials: {},
      accessKeyId: '...',
      region: '...',
      secretAccessKey: '...',
      credentialProvider: {}
    }, //optional
    delaySeconds: 0,// optional
    encoder: JSON_V2, // optional (defaults to JSON_V2)
    log: noop // optional (defaults to console)
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl, // this would typically be a CLSContext or ExplicitContext
  localServiceName: 'service-a' // name of this application
});
```
