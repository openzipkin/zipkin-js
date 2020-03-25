/* eslint-disable no-console */
const {jsonEncoder: {JSON_V1}} = require('zipkin');
const AwsSqsLogger = require('../src/AwsSqsLogger');

describe('Aws SQS transport', () => {
  it('should accept to JSON_V2 encoder', () => {
    const logger = new AwsSqsLogger({queueUrl: 'http://localhost:4568'});
    expect(logger.encoder.encode({
      traceId: 'a', id: 'b', annotations: [], tags: {}
    }))
      .to.equal('{"traceId":"a","id":"b"}');
  });

  it('should reject to JSON_V1 encoder', () => {
    expect(() => new AwsSqsLogger({encoder: JSON_V1, queueUrl: 'http://localhost:4568'})).to.throw(
      'Unsupported encoder. Valid choices are THRIFT and JSON_V2.'
    );
  });
});
