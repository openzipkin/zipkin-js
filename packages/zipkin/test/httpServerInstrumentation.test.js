const BatchRecorder = require('../src/batch-recorder');
const ExplicitContext = require('../src/explicit-context');
const HttpServer = require('../src/instrumentation/httpServer');
const InetAddress = require('../src/InetAddress');
const {JSON_V2} = require('../src/jsonEncoder');
const {Some, None} = require('../src/option');
const Tracer = require('../src/tracer');
const {expectSpan} = require('../../../test/testFixture');

describe('Http Server Instrumentation', () => {
  const serviceName = 'weather-api';
  const baseURL = 'http://127.0.0.1:80';
  const ipv4 = InetAddress.getLocalAddress().ipv4(); // tracer uses this IP for localEndpoint.ipv4

  function readHeader(headers) {
    return name => (headers[name] ? new Some(headers[name]) : None);
  }

  let spans;
  let tracer;
  let instrumentation;

  beforeEach(() => { // TODO: extract this logic as it is reused in tracer, client and server tests
    spans = [];
    tracer = new Tracer({
      ctxImpl: new ExplicitContext(),
      localServiceName: serviceName,
      recorder: new BatchRecorder({
        logger: {
          logSpan: (span) => {
            spans.push(JSON.parse(JSON_V2.encode(span)));
          }
        }
      })
    });
    instrumentation = new HttpServer({tracer, port: 80});
  });

  afterEach(() => expect(spans).to.be.empty);

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function successSpan(path, city) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4, port: 80},
      tags: {
        'http.path': path,
        'http.status_code': '200',
        city
      }
    });
  }

  function errorSpan(path, city, status) {
    return ({
      name: 'get',
      kind: 'SERVER',
      localEndpoint: {serviceName, ipv4, port: 80},
      tags: {
        'http.path': path,
        'http.status_code': status.toString(),
        error: status.toString(), // TODO: better error message especially on 500
        city
      }
    });
  }

  it('should start a new trace', () => {
    const path = '/weather/wuhan';
    const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, () => None);
    tracer.recordBinary('city', 'wuhan');
    instrumentation.recordResponse(id, 200);

    expectSpan(popSpan(), successSpan(path, 'wuhan'));
  });

  it('http.path tag should not include query parameters', () => {
    const path = '/weather/wuhan';
    const url = `${baseURL}${path}?index=10&count=300`;
    const id = instrumentation.recordRequest('GET', url, () => None);
    tracer.recordBinary('city', 'wuhan');
    instrumentation.recordResponse(id, 200);

    expectSpan(popSpan(), successSpan(path, 'wuhan'));
  });

  it('should receive continue a trace from the client', () => {
    const headers = {
      'X-B3-TraceId': '863ac35c9f6413ad',
      'X-B3-SpanId': '48485a3953bb6124',
      'X-B3-Flags': '1'
    };

    const path = '/weather/wuhan';
    const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, readHeader(headers));
    tracer.recordBinary('city', 'wuhan');
    instrumentation.recordResponse(id, 200);

    const span = popSpan();
    expect(span.traceId).to.equal('863ac35c9f6413ad');
    expect(span.id).to.equal('48485a3953bb6124');
    expectSpan(span, {...successSpan(path, 'wuhan'), ...{debug: true, shared: true}});
  });

  it('should accept a 128bit X-B3-TraceId', () => {
    const traceId = '863ac35c9f6413ad48485a3953bb6124';

    const headers = {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': '48485a3953bb6124',
      'X-B3-Flags': '1'
    };

    const path = '/weather/wuhan';
    const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, readHeader(headers));
    instrumentation.recordResponse(id, 200);

    expect(popSpan().traceId).to.equal(traceId);
  });

  it('should report 401 in tags', () => {
    const path = '/weather/securedTown';
    const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, () => None);
    tracer.recordBinary('city', 'securedTown');
    instrumentation.recordResponse(id, 401);

    expectSpan(popSpan(), errorSpan(path, 'securedTown', 401));
  });

  it('should report 500 in tags', () => {
    const path = '/weather/bagCity';
    const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, () => None);
    tracer.recordBinary('city', 'bagCity');
    instrumentation.recordResponse(id, 500);

    expectSpan(popSpan(), errorSpan(path, 'bagCity', 500));
  });

  it('should make span name from route on success when routing available', () => {
    expect(instrumentation.spanNameFromRoute('GET', '/users/:userId', 200))
      .to.equal('GET /users/:userId'); // zipkin will implicitly lowercase this
  });

  // source of redirect can be unlimited cardinality
  it('should make fixed span name for redirect when routing available', () => {
    expect(instrumentation.spanNameFromRoute('GET', '', 307))
      .to.equal('GET redirected'); // zipkin will implicitly lowercase this
  });

  // source of 404 can be unlimited cardinality
  it('should make fixed span name for not found when routing available', () => {
    expect(instrumentation.spanNameFromRoute('DELETE', '/bears and trees', 404))
      .to.equal('DELETE not_found'); // zipkin will implicitly lowercase this
  });

  const samplingFlagCases = [
    {headers: {'X-B3-Flags': '0'}, shouldSample: true}, // because this is meaningless
    {headers: {'X-B3-Flags': '1'}, shouldSample: true},
    {headers: {'X-B3-Sampled': '0'}, shouldSample: false},
    {headers: {'X-B3-Sampled': '1'}, shouldSample: true},
    {headers: {'X-B3-Sampled': 'true'}, shouldSample: true},
    {headers: {'X-B3-Sampled': 'false'}, shouldSample: false},
    {headers: {'X-B3-Sampled': '0', 'X-B3-Flags': '0'}, shouldSample: false},
    {headers: {'X-B3-Sampled': '0', 'X-B3-Flags': '1'}, shouldSample: true},
    {headers: {'X-B3-Sampled': '1', 'X-B3-Flags': '0'}, shouldSample: true},
    {headers: {'X-B3-Sampled': '1', 'X-B3-Flags': '1'}, shouldSample: true},
  ];

  samplingFlagCases.forEach(({headers, shouldSample}) => {
    const caseName = [];

    if (headers['X-B3-Flags']) {
      caseName.push(`flags=${headers['X-B3-Flags']}`);
    }

    if (headers['X-B3-Sampled']) {
      caseName.push(`sampled=${headers['X-B3-Sampled']}`);
    }

    if (caseName.length === 0) {
      caseName.push('no-flags');
    }

    it(`should receive sampling flags from the client with ${caseName.join(', ')}`, () => {
      const path = '/weather/wuhan';
      const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, readHeader(headers));
      tracer.recordBinary('city', 'wuhan');
      instrumentation.recordResponse(id, 200);

      if (shouldSample === true) {
        let expected = successSpan(path, 'wuhan');
        if (headers['X-B3-Flags'] === '1') {
          expected = {...expected, ...{debug: true}};
        }
        expectSpan(popSpan(), expected);
      } else {
        expect(spans).to.be.empty; // eslint-disable-line no-unused-expressions
      }
    });
  });

  it('should allow the host to be overridden', () => { // NOTE: this is actually IP as encoded
    instrumentation = new HttpServer({tracer, host: '1.1.1.1', port: 80});

    const path = '/weather/wuhan';
    const id = instrumentation.recordRequest('GET', `${baseURL}${path}`, () => None);
    tracer.recordBinary('city', 'wuhan');
    instrumentation.recordResponse(id, 200);

    expectSpan(popSpan(), {
      ...successSpan(path, 'wuhan'),
      ...{localEndpoint: {serviceName, ipv4: '1.1.1.1', port: 80}}
    });
  });
});
