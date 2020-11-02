// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import AWS from 'aws-sdk';

const AWSMock = require('aws-sdk-mock');

AWSMock.setSDKInstance(AWS);

const {
  Tracer, BatchRecorder, Annotation, ExplicitContext
} = require('zipkin');
const AwsSqsLogger = require('../src/AwsSqsLogger');

const triggerPublish = (logger) => {
  const ctxImpl = new ExplicitContext();
  const recorder = new BatchRecorder({logger});
  const tracer = new Tracer({recorder, ctxImpl});

  ctxImpl.scoped(() => {
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordServiceName('my-service');
    tracer.recordRpc('GET');
    tracer.recordBinary('http.url', 'http://example.com');
    tracer.recordBinary('http.response_code', '200');
    tracer.recordAnnotation(new Annotation.ServerSend());
  });
};
const triggerLargePublish = (logger) => {
  const ctxImpl = new ExplicitContext();
  const recorder = new BatchRecorder({logger});
  const tracer = new Tracer({recorder, ctxImpl});

  ctxImpl.scoped(() => {
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordServiceName('my-service');
    tracer.recordRpc('GET');
    tracer.recordBinary('http.url', 'http://example.com');
    tracer.recordBinary('http.response_code', '200');
    for (let i = 0; i < 5000; i += 1) {
      tracer.recordAnnotation(new Annotation.Message(`Message ${i + 1}`));
    }
    tracer.recordAnnotation(new Annotation.ServerSend());
  });
};

describe('AWS SQS transport - integration test', () => {
  it('should send trace data to AWS SQS', function() {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);
    AWSMock.mock('SQS', 'sendMessage', (params) => {
      const message = JSON.parse(params.MessageBody)[0];
      expect(message.tags['http.url']).to.equal('http://example.com');
      expect(message.tags['http.response_code']).to.equal('200');
      expect(message.name).to.equal('get');
      expect(message.kind).to.equal('SERVER');
    });
    const awsSqsLogger = new AwsSqsLogger({
      pollerSeconds: 1,
      awsConfig: {
        region: 'eu-west-1',
        sslEnabled: false
      },
      queueUrl: 'http://localhost:4568/zipkin_queue_test',
    });
    triggerPublish(awsSqsLogger);
  });

  it('should emit an error when payload size is too large', function(done) {
    this.slow(10 * 1000);
    this.timeout(60 * 1000);
    const awsSqsLogger = new AwsSqsLogger({
      pollerSeconds: 1,
      errorListenerSet: true,
      awsConfig: {
        region: 'eu-west-1',
        sslEnabled: false
      },
      queueUrl: 'http://localhost:4568/zipkin_queue_test',
    });
    awsSqsLogger.on('error', () => {
      done();
    });
    triggerLargePublish(awsSqsLogger);
  });
});
