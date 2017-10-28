require('babel-polyfill');

const fetch = require('node-fetch');
const zipkin = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const {HttpLogger} = require('zipkin-transport-http');
const ctxImpl = new CLSContext();

const ZIPKIN_ENDPOINT = 'http://localhost:9411/api/v2/spans';

const tracer = new zipkin.Tracer({
  ctxImpl,
  recorder: new zipkin.BatchRecorder({
    logger: new HttpLogger({
      endpoint: ZIPKIN_ENDPOINT,
      jsonEncoder: zipkin.jsonEncoder.JSON_V2
    }),
  }),
  sampler: new zipkin.sampler.CountingSampler(1),
});

const testCases = require('../shared');

describe('E2E - Node: Spans', () => {
  it('should be able to create a span', async () => {
    const beforeResult = await fetch(`${ZIPKIN_ENDPOINT}?serviceName=test1`).then(res => res.json());
    expect(beforeResult).to.eql([]);

    await testCases.createSpan({tracer, zipkin});

    const afterResult = await fetch(`${ZIPKIN_ENDPOINT}?serviceName=test1`).then(res => res.json());
    expect(afterResult.length).to.equal(1);
  });
});
