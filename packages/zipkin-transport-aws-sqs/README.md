# Zipkin-transport-aws-sqs

![npm](https://img.shields.io/npm/dm/zipkin-transport-aws-sqs.svg)

This is a module that sends Zipkin trace data to Amazon SQS for collection and processing.
SQS is an alternative to Apache Kafka that is fully managed in the AWS cloud.
## Usage

`npm install zipkin-transport-aws-sqs --save`

```javascript
const {
  Tracer,
  BatchRecorder
} = require('zipkin');
const {AwsSqsLogger} = require('zipkin-transport-aws-sqs');
const noop = require('noop-logger');

let awsSqsLogger = new AwsSqsLogger({
                         queueUrl: "https://...", //mandatory
                         endpointConfiguration: AWS.Endpoint, // optional
                         region: 'eu-west-1', // optional, region string
                         credentialProvider: AWS.CredentialProviderChain, // optional
                         delaySeconds: 0, // optional
                         log: noop // optional (defaults to console)
                       });

const AwsSqsRecorder = new BatchRecorder({
  logger: awsSqsLogger
});

const tracer = new Tracer({
  recorder,
  ctxImpl, // this would typically be a CLSContext or ExplicitContext
  localServiceName: 'service-a' // name of this application
});
```
## Requirements

AWS credentials will be loaded as described [here](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials.html). The credentials must have the following permissions:

`sqs:DescribeStream` for health checking

`sqs:PutRecord` for placing spans on the queue

## Message encoding
The message's binary data includes a list of spans in the same JSON V2 format
as the http [POST /spans](http://zipkin.io/zipkin-api/#/paths/%252Fspans) body.

# Related work

[collector-sqs](https://github.com/openzipkin/zipkin-aws/tree/master/collector-sqs)
integrates with zipkin-server to pull spans off of an SQS queue instead
of HTTP or Kafka.
