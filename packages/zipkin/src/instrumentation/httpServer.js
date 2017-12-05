const Header = require('../httpHeaders');
const {Some, None} = require('../option');
const TraceId = require('../tracer/TraceId');
const Annotation = require('../annotation');

function stringToBoolean(str) {
  return str === '1' || str === 'true';
}

function stringToIntOption(str) {
  try {
    return new Some(parseInt(str));
  } catch (err) {
    return None;
  }
}

function containsRequiredHeaders(readHeader) {
  return readHeader(Header.TraceId) !== None && readHeader(Header.SpanId) !== None;
}

function requiredArg(name) {
  throw new Error(`HttpServerInstrumentation: Missing required argument ${name}.`);
}

class HttpServerInstrumentation {
  constructor({
    tracer = requiredArg('tracer'),
    serviceName = tracer.localEndpoint.serviceName,
    port = requiredArg('port')
  }) {
    this.tracer = tracer;
    this.serviceName = serviceName;
    this.port = port;
  }

  _createIdFromHeaders(readHeader) {
    if (containsRequiredHeaders(readHeader)) {
      const spanId = readHeader(Header.SpanId);
      return spanId.map(sid => {
        const traceId = readHeader(Header.TraceId);
        const parentSpanId = readHeader(Header.ParentSpanId);
        const sampled = readHeader(Header.Sampled);
        const flags = readHeader(Header.Flags).flatMap(stringToIntOption).getOrElse(0);
        return new TraceId({
          traceId,
          parentId: parentSpanId,
          spanId: sid,
          sampled: sampled.map(stringToBoolean),
          flags
        });
      });
    } else {
      if (readHeader(Header.Flags) !== None) {
        const currentId = this.tracer.id;
        const idWithFlags = new TraceId({
          traceId: currentId.traceId,
          parentId: currentId.parentId,
          spanId: currentId.spanId,
          sampled: currentId.sampled,
          flags: readHeader(Header.Flags)
        });
        return new Some(idWithFlags);
      } else {
        return new Some(this.tracer.createRootId());
      }
    }
  }

  recordRequest(method, requestUrl, readHeader) {
    this._createIdFromHeaders(readHeader).ifPresent(id => this.tracer.setId(id));
    const id = this.tracer.id;

    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(method.toUpperCase());
    this.tracer.recordBinary('http.url', requestUrl);
    this.tracer.recordAnnotation(new Annotation.ServerRecv());
    this.tracer.recordAnnotation(new Annotation.LocalAddr({port: this.port}));

    if (id.flags !== 0 && id.flags != null) {
      this.tracer.recordBinary(Header.Flags, id.flags.toString());
    }
    return id;
  }

  recordResponse(id, statusCode, error) {
    this.tracer.setId(id);
    this.tracer.recordBinary('http.status_code', statusCode.toString());
    if (error) {
      this.tracer.recordBinary('error', error.toString());
    }
    this.tracer.recordAnnotation(new Annotation.ServerSend());
  }
}

module.exports = HttpServerInstrumentation;
