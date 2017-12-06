const sinon = require('sinon');
const Tracer = require('../src/tracer');
const {Some, None} = require('../src/option');
const ExplicitContext = require('../src/explicit-context');
const HttpServer = require('../src/instrumentation/httpServer');

describe('Http Server Instrumentation', () => {
  it('should create traceId', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});
    const instrumentation = new HttpServer({tracer, serviceName: 'service-a', port: 80});

    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', '/foo', () => None);
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

    expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
    expect(annotations[0].annotation.serviceName).to.equal('service-a');

    expect(annotations[1].annotation.annotationType).to.equal('Rpc');
    expect(annotations[1].annotation.name).to.equal('POST');

    expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[2].annotation.key).to.equal('http.url');
    expect(annotations[2].annotation.value).to.equal('/foo');

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

  it('should receive trace info from the client', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const headers = {
      'X-B3-TraceId': 'aaa',
      'X-B3-SpanId': 'bbb',
      'X-B3-Flags': '1'
    };
    const port = 80;
    const url = `http://127.0.0.1:${port}`;
    const instrumentation = new HttpServer({tracer, serviceName: 'service-a', port});
    const readHeader = function(name) { return headers[name] ? new Some(headers[name]) : None; };
    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', url, readHeader);
      tracer.recordBinary('message', 'hello from within app');
      instrumentation.recordResponse(id, 202);
    });
    const annotations = record.args.map(args => args[0]);

    annotations.forEach(ann => expect(ann.traceId.traceId).to.equal('aaa'));
    annotations.forEach(ann => expect(ann.traceId.spanId).to.equal('bbb'));

    expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
    expect(annotations[0].annotation.serviceName).to.equal('service-a');

    expect(annotations[1].annotation.annotationType).to.equal('Rpc');
    expect(annotations[1].annotation.name).to.equal('POST');

    expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[2].annotation.key).to.equal('http.url');
    expect(annotations[2].annotation.value).to.equal(url);

    expect(annotations[3].annotation.annotationType).to.equal('ServerRecv');

    expect(annotations[4].annotation.annotationType).to.equal('LocalAddr');

    expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[5].annotation.key).to.equal('X-B3-Flags');
    expect(annotations[5].annotation.value).to.equal('1');

    expect(annotations[6].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[6].annotation.key).to.equal('message');
    expect(annotations[6].annotation.value).to.equal('hello from within app');

    expect(annotations[7].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[7].annotation.key).to.equal('http.status_code');
    expect(annotations[7].annotation.value).to.equal('202');

    expect(annotations[8].annotation.annotationType).to.equal('ServerSend');
  });

  it('should properly report the URL with a query string', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const port = 80;
    const instrumentation = new HttpServer({tracer, serviceName: 'service-a', port});
    const url = `http://127.0.0.1:${port}/foo?abc=123`;
    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('GET', url, () => None);
      tracer.recordBinary('message', 'hello from within app');
      instrumentation.recordResponse(id, 202);
    });
    const annotations = record.args.map(args => args[0]);

    expect(annotations[2].annotation.annotationType).to.equal('BinaryAnnotation');
    expect(annotations[2].annotation.key).to.equal('http.url');
    expect(annotations[2].annotation.value).to.equal(url);
  });

  it('should accept a 128bit X-B3-TraceId', () => {
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const port = 80;
    const instrumentation = new HttpServer({tracer, serviceName: 'service-a', port});
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
    const record = sinon.spy();
    const recorder = {record};
    const ctxImpl = new ExplicitContext();
    const tracer = new Tracer({recorder, ctxImpl});

    const headers = {
      'X-B3-TraceId': 'aaa',
      'X-B3-SpanId': 'bbb',
      'X-B3-Flags': '1',
      'X-B3-Sampled': 'true'
    };

    const port = 80;
    const url = `http://127.0.0.1:${port}`;
    const instrumentation = new HttpServer({tracer, serviceName: 'service-a', port});
    const readHeader = function(name) { return headers[name] ? new Some(headers[name]) : None; };
    ctxImpl.scoped(() => {
      const id = instrumentation.recordRequest('POST', url, readHeader);
      expect(id._sampled.value).to.equal(true);
    });
  });
});
