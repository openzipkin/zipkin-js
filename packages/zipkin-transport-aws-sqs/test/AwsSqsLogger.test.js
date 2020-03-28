const AwsSqsLogger = require('../src/AwsSqsLogger');

describe('Aws SQS transport', () => {
  it('should accept to JSON_V2 encoder', () => {
    const logger = new AwsSqsLogger({queueUrl: 'http://localhost:4568'});
    expect(logger.encoder.encode({
      traceId: 'a', id: 'b', annotations: [], tags: {}
    }))
      .to.equal('{"traceId":"a","id":"b"}');
  });
});
