const Request = require('../src/request.js');
const HttpHeaders = require('../src/httpHeaders');
const {Some} = require('../src/option');
const TraceId = require('../src/tracer/TraceId');

describe('Request', () => {
  it('should add trace/span and ignore parent span/sampled headers if they do not exist', () => {
    const traceId = new TraceId({
      spanId: '48485a3953bb6124'
    });
    const req = Request.addZipkinHeaders({}, traceId);

    expect(req.headers[HttpHeaders.TraceId]).to.equal('48485a3953bb6124');
    expect(req.headers[HttpHeaders.SpanId]).to.equal('48485a3953bb6124');
  });

  it('should add trace, span, parent span, and sampled headers', () => {
    const traceId = new TraceId({
      traceId: '48485a3953bb6124',
      spanId: '48485a3953bb6124',
      parentId: new Some('d56852c923dc9325'),
      sampled: new Some(true)
    });
    const req = Request.addZipkinHeaders({}, traceId);

    expect(req.headers[HttpHeaders.TraceId]).to.equal('48485a3953bb6124');
    expect(req.headers[HttpHeaders.SpanId]).to.equal('48485a3953bb6124');
    expect(req.headers[HttpHeaders.ParentSpanId]).to.equal('d56852c923dc9325');
  });

  it('should add flags headers if debug is on', () => {
    const traceId = new TraceId({
      spanId: '48485a3953bb6124',
      flags: 1
    });
    const req = Request.addZipkinHeaders({}, traceId);

    expect(req.headers[HttpHeaders.Flags]).to.equal('1');
    expect(req.headers[HttpHeaders.SpanId]).to.equal('48485a3953bb6124');
  });
});
