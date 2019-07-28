function inBrowser() {
  return typeof window !== 'undefined' && typeof window.__karma__ !== 'undefined';
}

// Returns test endpoint middleware or null if in a browser. If in a browser, use relative urls.
function maybeMiddleware() {
  // First, check if we are running tests inside the web browser. If so, we expect Karma's server
  // host the endpoints we need. This means we use a relative instead of an absolute URL in tests.
  if (inBrowser()) return null;

  // Intentionally defer express middleware to avoid attempts to bundle it when in a browser
  // eslint-disable-next-line global-require
  const middleware = require('./middleware');
  return middleware();
}

// Sets up a test server appropriate for either normal mocha or browser-based tests.
//
// Installation should be like this
//
// const server = setupTestServer();
//
// Later, you can get a url for clients to use via server.url(path)
//
// Approach is from https://github.com/mochajs/mocha/wiki/Shared-Behaviours
function setupTestServer() {
  before((done) => {
    const middleware = maybeMiddleware();
    if (middleware !== null) {
      this.server = middleware.listen(0, () => {
        this.baseURL = `http://127.0.0.1:${this.server.address().port}`;
        done();
      });
    } else { // Inside a browser
      this.baseURL = ''; // default to relative path, for browser-based tests
      done();
    }
  });

  after(() => {
    if (this.server) this.server.close();
  });

  return { // these use global references as we are leaving 'this'
    url(path) {
      return `${global.baseURL}${path}?index=10&count=300`;
    }
  };
}

function _expectSpan(span, expected) {
  expect(span.traceId).to.have.lengthOf(16);
  expect(span.id).to.have.lengthOf(16);

  const volatileProperties = {
    traceId: span.traceId,
    id: span.id,
    timestamp: span.timestamp,
    duration: span.duration
  };

  if (span.parentId) volatileProperties.parentId = span.parentId;

  expect(span).to.deep.equal({...volatileProperties, ...expected});
}

// This initially holds no state as we need to await before hook to set it up.
class TestTracer {
  constructor({localServiceName}) {
    // TODO see if we can conditionally load from package because when testing zipkin itself we want
    // to use explicit paths
    const {
      BatchRecorder, ExplicitContext, TraceId, Tracer, jsonEncoder: {JSON_V2}
    }
     = require('zipkin');

    this._spans = [];
    this._tracer = new Tracer({
      ctxImpl: new ExplicitContext(),
      localServiceName,
      recorder: new BatchRecorder({
        logger: {
          logSpan: (span) => {
            this._spans.push(JSON.parse(JSON_V2.encode(span)));
          }
        }
      })
    });
    this._sentinelTraceId = this._tracer.id;
    this._debugId = new TraceId({spanId: this._tracer.id.traceId, debug: true});
  }

  // As long as we call this on afterEach, and tests are executed sequentially.
  // we can reuse this tracer for any number of tests
  expectNoLeaks() {
    expect(this._tracer.id).to.equal(this._sentinelTraceId); // no context leaks
    expect(this._spans).to.be.empty; // eslint-disable-line no-unused-expressions
  }

  tracer() {
    return this._tracer;
  }

  popSpan() {
    expect(this._spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return this._spans.pop();
  }

  popDebugSpan() {
    const span = this.popSpan();
    expect(span.debug).to.equal(true);
    return span;
  }

  expectSpan(span, expected) {
    return _expectSpan(span, expected);
  }

  expectNextSpanToEqual(expected) {
    const span = this.popSpan();
    _expectSpan(span, expected);
    return span;
  }

  runInDebugTrace(callback) {
    return this._tracer.letId(this._debugId, callback);
  }
}

// Sets up a test tracer that records spans as objects that appear as V2 json format.
//
// Installation should be like this
//
// const tracer = setupTestTracer({localServiceName: serviceName});
//
// Later, you can take a span via tracer.popSpan(). If you don't read all spans like this, an error
// will occur in the afterEach hook.
//
// Approach is from https://github.com/mochajs/mocha/wiki/Shared-Behaviours
function setupTestTracer(options) {
  const testTracer = new TestTracer(options);

  // Checking for leaks helps us avoid lazy instantiation.
  afterEach(() => testTracer.expectNoLeaks());

  return testTracer;
}

function expectB3Headers(span, headers, caseInsensitive = true) {
  expect(headers[caseInsensitive ? 'x-b3-traceid' : 'X-B3-TraceId']).to.equal(span.traceId);
  expect(headers[caseInsensitive ? 'x-b3-spanid' : 'X-B3-SpanId']).to.equal(span.id);
  expect(headers[caseInsensitive ? 'x-b3-sampled' : 'X-B3-Sampled']).to.equal('1');

  const parentIdHeader = headers[caseInsensitive ? 'x-b3-parentspanid' : 'X-B3-ParentSpanId'];
  if (span.parentId) {
    expect(parentIdHeader).to.equal(span.parentId);
  } else {
    expect(parentIdHeader).to.not.exist;
  }

  const flagsHeader = headers[caseInsensitive ? 'x-b3-flags' : 'X-B3-Flags'];
  if (span.debug) {
    expect(flagsHeader).to.equal('1');
  } else {
    expect(flagsHeader).to.not.exist;
  }
}

// TODO: remove expectSpan when porting is done
function expectSpan(span, expected) {
  return _expectSpan(span, expected);
}

module.exports = {
  inBrowser, setupTestServer, setupTestTracer, expectB3Headers, expectSpan
};
