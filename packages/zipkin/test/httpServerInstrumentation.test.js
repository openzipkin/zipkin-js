const sinon = require('sinon');
const Tracer = require('../src/tracer');
const {Some, None} = require('../src/option');
const {Sampler, alwaysSample, neverSample} = require('../src/tracer/sampler');
const ExplicitContext = require('../src/explicit-context');
const HttpServer = require('../src/instrumentation/httpServer');

const setupTest = () => {
  const record = sinon.spy();
  const setDefaultTags = sinon.spy();
  const recorder = {record, setDefaultTags};
  const ctxImpl = new ExplicitContext();
  const defaultTags = {instanceId: 'i-1234567890abcdef0'};
  return {
    record, recorder, ctxImpl, defaultTags
  };
};

const setupServerUrl = () => {
  const port = 80;
  const host = '127.0.0.1';
  const url = `http://${host}:${port}`;
  return {port, host, url};
};

describe('Http Server Instrumentation', () => {
  const serviceName = 'weather-app';

  it('should create traceId', () => {
    const {record, recorder, ctxImpl} = setupTest();
    const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});
    const instrumentation = new HttpServer({tracer, port: 80});
    const url = '/foo';

    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', url, () => None);
      tracer.recordBinary('message', 'hello from within app');
      instrumentation.recordResponse(id, 202);
    });
    const annotations = record.args.map(args => args[0]);
    const originalTraceId = annotations[0].traceId.traceId;
    const originalSpanId = annotations[0].traceId.spanId;

    annotations.forEach(ann => expect(ann.traceId.traceId)
      .to.have.lengthOf(16).and
      .to.equal(originalTraceId));
    annotations.forEach(ann => expect(ann.traceId.spanId)
      .to.have.lengthOf(16).and
      .to.equal(originalSpanId));
    annotations.forEach(ann => expect(ann.traceId.isShared()).to.equal(false));

    expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
    expect(annotations[0].annotation.serviceName).to.equal(serviceName);

    expect(annotations[1].annotation.annotationType).to.equal('Rpc');
    expect(annotations[1].annotation.name).to.equal('POST');

    expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[2].annotation.key).to.equal('http.path');
    expect(annotations[2].annotation.value).to.equal(url);

    expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

    expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

    expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[5].annotation.key).to.equal('message');
    expect(annotations[5].annotation.value).to.equal('hello from within app');

    expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[6].annotation.key).to.equal('http.status_code');
    expect(annotations[6].annotation.value).to.equal('202');

    expect(annotations[7].annotation.annotationType).to.equal('ServerSend');
  });

  const traceContextCases = [
    {
      'X-B3-TraceId': 'aaa',
      'X-B3-SpanId': 'bbb',
      'X-B3-Flags': '1'
    },
    {
      'X-B3-TraceId': 'aaa',
      'X-B3-SpanId': 'bbb',
      'X-B3-Sampled': '1'
    }
  ];

  traceContextCases.forEach((headers, index) => {
    it(`should extract trace from the client and record annotations case ${index}`, () => {
      const {record, recorder, ctxImpl} = setupTest();
      const tracer = new Tracer({recorder, ctxImpl});

      const {port, url} = setupServerUrl();
      const instrumentation = new HttpServer({tracer, serviceName, port});

      const readHeader = function(name) {
        return headers[name] ? new Some(headers[name]) : None;
      };
      ctxImpl.scoped(() => {
        const id = instrumentation.recordRequest('POST', url, readHeader);
        tracer.recordBinary('message', 'hello from within app');
        instrumentation.recordResponse(id, 202);
      });
      const annotations = record.args.map(args => args[0]);

      annotations.forEach(ann => expect(ann.traceId.traceId).to.equal('aaa'));
      annotations.forEach(ann => expect(ann.traceId.spanId).to.equal('bbb'));
      annotations.forEach(ann => expect(ann.traceId.isShared()).to.equal(true));

      expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
      expect(annotations[0].annotation.serviceName).to.equal(serviceName);

      expect(annotations[1].annotation.annotationType).to.equal('Rpc');
      expect(annotations[1].annotation.name).to.equal('POST');

      expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
      expect(annotations[2].annotation.key).to.equal('http.path');
      expect(annotations[2].annotation.value).to.equal('/');

      expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

      expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

      expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
      expect(annotations[5].annotation.key).to.equal('message');
      expect(annotations[5].annotation.value).to.equal('hello from within app');

      expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
      expect(annotations[6].annotation.key).to.equal('http.status_code');
      expect(annotations[6].annotation.value).to.equal('202');

      expect(annotations[7].annotation.annotationType).to.equal('ServerSend');
    });
  });

  traceContextCases.forEach((headers, index) => {
    it(`should should not join spans if join not supported case ${index}`, () => {
      const {record, recorder, ctxImpl} = setupTest();
      const supportsJoin = false;
      const tracer = new Tracer({
        recorder, ctxImpl, localServiceName: serviceName, supportsJoin
      });

      const {port, url} = setupServerUrl();
      const instrumentation = new HttpServer({tracer, port});

      const readHeader = function(name) {
        return headers[name] ? new Some(headers[name]) : None;
      };
      ctxImpl.scoped(() => {
        const id = instrumentation.recordRequest('POST', url, readHeader);
        tracer.recordBinary('message', 'hello from within app');
        instrumentation.recordResponse(id, 202);
      });
      const annotations = record.args.map(args => args[0]);

      annotations.forEach(ann => expect(ann.traceId.traceId).to.equal('aaa'));
      annotations.forEach(ann => expect(ann.traceId.parentSpanId.getOrElse()).to.equal('bbb'));
      annotations.forEach(ann => expect(ann.traceId.spanId).to.not.equal('bbb'));
      annotations.forEach(ann => expect(ann.traceId.isShared()).to.equal(false));

      expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
      expect(annotations[0].annotation.serviceName).to.equal(serviceName);

      expect(annotations[1].annotation.annotationType).to.equal('Rpc');
      expect(annotations[1].annotation.name).to.equal('POST');

      expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
      expect(annotations[2].annotation.key).to.equal('http.path');
      expect(annotations[2].annotation.value).to.equal('/');

      expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

      expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

      expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
      expect(annotations[5].annotation.key).to.equal('message');
      expect(annotations[5].annotation.value).to.equal('hello from within app');

      expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
      expect(annotations[6].annotation.key).to.equal('http.status_code');
      expect(annotations[6].annotation.value).to.equal('202');

      expect(annotations[7].annotation.annotationType).to.equal('ServerSend');
    });
  });

  const samplingFlagCases = [
    {headers: {'X-B3-Flags': '0'}, hasAnnotations: null},
    {headers: {'X-B3-Flags': '1'}, hasAnnotations: true},
    {headers: {'X-B3-Sampled': '0'}, hasAnnotations: false},
    {headers: {'X-B3-Sampled': '1'}, hasAnnotations: true},
    {headers: {'X-B3-Sampled': 'true'}, hasAnnotations: true},
    {headers: {'X-B3-Sampled': 'false'}, hasAnnotations: false},
    {headers: {'X-B3-Sampled': '0', 'X-B3-Flags': '0'}, hasAnnotations: false},
    {headers: {'X-B3-Sampled': '0', 'X-B3-Flags': '1'}, hasAnnotations: true},
    {headers: {'X-B3-Sampled': '1', 'X-B3-Flags': '0'}, hasAnnotations: true},
    {headers: {'X-B3-Sampled': '1', 'X-B3-Flags': '1'}, hasAnnotations: true},
  ];

  samplingFlagCases.forEach(({headers, hasAnnotations}) => {
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
      const {record, recorder, ctxImpl} = setupTest();
      const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});

      const {port, url} = setupServerUrl();
      const instrumentation = new HttpServer({tracer, port});

      const readHeader = function(name) {
        return headers[name] ? new Some(headers[name]) : None;
      };

      ctxImpl.scoped(() => {
        const id = instrumentation.recordRequest('POST', url, readHeader);
        tracer.recordBinary('message', 'hello from within app');
        instrumentation.recordResponse(id, 202);
      });

      const annotations = record.args.map(args => args[0]);

      if (hasAnnotations === true) {
        annotations.forEach(ann => expect(ann.traceId.traceId).to.not.be.empty);
        annotations.forEach(ann => expect(ann.traceId.spanId).to.not.be.empty);
        annotations.forEach(ann => expect(ann.traceId.isShared()).to.equal(false));

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
        expect(annotations[0].annotation.serviceName).to.equal(serviceName);

        expect(annotations[1].annotation.annotationType).to.equal('Rpc');
        expect(annotations[1].annotation.name).to.equal('POST');

        expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[2].annotation.key).to.equal('http.path');
        expect(annotations[2].annotation.value).to.equal('/');

        expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

        expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

        expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[5].annotation.key).to.equal('message');
        expect(annotations[5].annotation.value).to.equal('hello from within app');

        expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[6].annotation.key).to.equal('http.status_code');
        expect(annotations[6].annotation.value).to.equal('202');

        expect(annotations[7].annotation.annotationType).to.equal('ServerSend');
      } else if (hasAnnotations === false) {
        // nothing should be recorded
        expect(annotations.length).to.equal(0);
      }
    });
  });

  it('should properly report the path excluding the query string', () => {
    const {record, recorder, ctxImpl} = setupTest();
    const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});

    const port = 80;
    const host = '127.0.0.1';
    const urlPath = '/foo';
    const instrumentation = new HttpServer({tracer, port});
    const url = `http://${host}:${port}${urlPath}?abc=123`;
    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('GET', url, () => None);
      tracer.recordBinary('message', 'hello from within app');
      instrumentation.recordResponse(id, 202);
    });
    const annotations = record.args.map(args => args[0]);

    expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[2].annotation.key).to.equal('http.path');
    expect(annotations[2].annotation.value).to.equal(urlPath);
  });

  it('should accept a 128bit X-B3-TraceId', () => {
    const {record, recorder, ctxImpl} = setupTest();
    const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});

    const port = 80;
    const instrumentation = new HttpServer({tracer, port});
    const url = `http://127.0.0.1:${port}`;
    const traceId = '863ac35c9f6413ad48485a3953bb6124';
    const headers = {
      'X-B3-TraceId': traceId,
      'X-B3-SpanId': '48485a3953bb6124',
      'X-B3-Flags': '1'
    };
    const readHeader = function(name) { return headers[name] ? new Some(headers[name]) : None; };
    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', url, readHeader);
      tracer.recordBinary('message', 'hello from within app');
      instrumentation.recordResponse(id, 202);
    });

    const annotations = record.args.map(args => args[0]);

    annotations.forEach(ann => expect(ann.traceId.traceId).to.equal(traceId));
  });

  it('should tolerate boolean literals for sampled header received from the client', () => {
    const {recorder, ctxImpl} = setupTest();
    const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});

    const headersCases = [
      {
        'X-B3-TraceId': 'aaa',
        'X-B3-SpanId': 'bbb',
        'X-B3-Flags': '1',
        'X-B3-Sampled': 'true'
      },
      {
        'X-B3-Flags': '1',
        'X-B3-Sampled': 'true'
      }
    ];

    headersCases.forEach((headers) => {
      const port = 80;
      const url = `http://127.0.0.1:${port}`;
      const instrumentation = new HttpServer({tracer, serviceName, port});
      const readHeader = function(name) {
        return headers[name] ? new Some(headers[name]) : None;
      };
      ctxImpl.scoped(() => {
        const id = instrumentation.recordRequest('POST', url, readHeader);
        expect(id._sampled.value).to.equal(true);
      });
    });
  });

  const samplerCases = [
    new Sampler(alwaysSample),
    new Sampler(neverSample)
  ];

  samplerCases.forEach((sampler) => {
    it(`should use sampler to calculate sampled value if missing in header (${sampler})`, () => {
      const {recorder, ctxImpl} = setupTest();
      const tracer = new Tracer({
        recorder, localServiceName: serviceName, ctxImpl, sampler
      });

      const headers = {
        'X-B3-TraceId': 'aaa',
        'X-B3-SpanId': 'bbb'
      };

      const {port, url} = setupServerUrl();
      const instrumentation = new HttpServer({tracer, serviceName, port});
      const readHeader = function(name) {
        return headers[name] ? new Some(headers[name]) : None;
      };
      ctxImpl.scoped(() => {
        const id = instrumentation.recordRequest('POST', url, readHeader);
        expect(id._sampled.value).to.equal(sampler.shouldSample(id).value);
      });
    });
  });

  it('should allow the host to be overridden', () => {
    const {record, recorder, ctxImpl} = setupTest();
    const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});
    const instrumentation = new HttpServer({
      tracer,
      serviceName,
      host: '1.1.1.1',
      port: 80
    });

    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', '/test-url', () => None);
      instrumentation.recordResponse(id, 202);
    });

    const localAddr = record.args
      .map(args => args[0].annotation)
      .find(annotation => annotation.annotationType === 'LocalAddr');

    expect(localAddr.host.addr).to.equal('1.1.1.1');
  });

  it('should work if the host option is not defined', () => {
    const {record, recorder, ctxImpl} = setupTest();
    const tracer = new Tracer({recorder, localServiceName: serviceName, ctxImpl});
    const instrumentation = new HttpServer({
      tracer,
      serviceName,
      port: 80
    });

    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', '/test-url', () => None);
      instrumentation.recordResponse(id, 202);
    });

    const localAddr = record.args
      .map(args => args[0].annotation)
      .find(annotation => annotation.annotationType === 'LocalAddr');

    expect(localAddr.host.addr).not.to.equal(undefined);
  });
});
