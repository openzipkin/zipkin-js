/* eslint-disable no-console */
const THRIFT = require('zipkin-encoder-thrift');
const {jsonEncoder: {JSON_V1, JSON_V2}} = require('zipkin');
const KafkaLogger = require('../src/KafkaLogger');

describe('Kafka transport', () => {
  it('should default to THRIFT encoder', () => {
    const logger = new KafkaLogger({clientOpts: {}});
    expect(logger.encoder).to.equal(THRIFT);
  });

  it('should accept to JSON_V2 encoder', () => {
    const logger = new KafkaLogger({encoder: JSON_V2, clientOpts: {}});
    expect(logger.encoder.encode({
      traceId: 'a', id: 'b', annotations: [], tags: {}
    }))
      .to.equal('[{"traceId":"a","id":"b"}]');
  });

  it('should reject to JSON_V1 encoder', () => {
    expect(() => new KafkaLogger({encoder: JSON_V1, clientOpts: {}})).to.throw(
      'Unsupported encoder. Valid choices are THRIFT and JSON_V2.'
    );
  });
});
