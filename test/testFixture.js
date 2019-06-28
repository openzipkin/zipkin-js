const {BatchRecorder, jsonEncoder: {JSON_V2}} = require('zipkin');

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
  return new BatchRecorder({logger: {logSpan: (span) => {
    spans.push(JSON.parse(JSON_V2.encode(span)));
  }}});
}

module.exports = {maybeMiddleware, newSpanRecorder}
