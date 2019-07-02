// Returns test endpoint middleware or null if in a browser. If in a browser, use relative urls.
function maybeMiddleware() {
  // First, check if we are running tests inside the web browser. If so, we expect Karma's server
  // host the endpoints we need. This means we use a relative instead of an absolute URL in tests.
  if (typeof window !== 'undefined' && typeof window.__karma__ !== 'undefined') {
    return null;
  }

  // Intentionally defer express middleware to avoid attempts to bundle it when in a browser
  // eslint-disable-next-line global-require
  const middleware = require('./middleware');
  return middleware();
}

// This will make a span recorder that adds to the passed array exactly as they would appear in json
function newSpanRecorder(spans) {
  const {BatchRecorder, jsonEncoder: {JSON_V2}} = require('zipkin');

  return new BatchRecorder({logger: {logSpan: (span) => {
    spans.push(JSON.parse(JSON_V2.encode(span)));
  }}});
}

function expectB3Headers(span, headers, caseInsensitive = true) {
  expect(headers[caseInsensitive ? 'x-b3-traceid' : 'X-B3-TraceId']).to.equal(span.traceId);
  expect(headers[caseInsensitive ? 'x-b3-spanid' : 'X-B3-SpanId']).to.equal(span.id);
  expect(headers[caseInsensitive ? 'x-b3-sampled' : 'X-B3-Sampled']).to.equal('1');

  /* eslint-disable no-unused-expressions */
  expect(headers[caseInsensitive ? 'x-b3-parentspanid' : 'X-B3-ParentSpanId']).to.not.exist;
  expect(headers[caseInsensitive ? 'x-b3-flags' : 'X-B3-Flags']).to.not.exist;
}

function expectSpan(span, expected) {
  expect(span.traceId).to.have.lengthOf(16);
  expect(span.id).to.have.lengthOf(16);

  const volatileProperties = {
    traceId: span.traceId,
    id: span.id,
    timestamp: span.timestamp,
    duration: span.duration
  }

  expect(span).to.deep.equal({...volatileProperties, ...expected});
}

module.exports = {maybeMiddleware, newSpanRecorder, expectB3Headers, expectSpan}
