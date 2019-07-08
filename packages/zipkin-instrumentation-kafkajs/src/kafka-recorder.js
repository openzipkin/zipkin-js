const {
  TraceId, option: {fromNullable}, Annotation, HttpHeaders
} = require('zipkin');

function bufferToAscii(maybeBuffer) { // TODO: backfill tests for this
  return Buffer.isBuffer(maybeBuffer) ? maybeBuffer.asciiSlice(0) : maybeBuffer;
}

const recordConsumeStart = (tracer, name, remoteServiceName, {topic, partition, message}) => {
  const traceId = message.headers[HttpHeaders.TraceId];
  const spanId = message.headers[HttpHeaders.SpanId];
  let id;

  if (traceId && spanId) {
    const parentId = message.headers[HttpHeaders.ParentSpanId];
    const sampled = message.headers[HttpHeaders.Sampled];
    const flags = message.headers[HttpHeaders.Flags];

    id = tracer.createChildId(new TraceId({
      traceId: bufferToAscii(traceId),
      parentId: fromNullable(parentId).map(bufferToAscii),
      spanId: bufferToAscii(spanId),
      sampled: fromNullable(sampled).map(bufferToAscii),
      debug: flags ? parseInt(flags) === 1 : false
    }));
  } else {
    id = tracer.createRootId();
  }

  tracer.setId(id);
  tracer.recordServiceName(tracer.localEndpoint.serviceName);
  tracer.recordRpc(name);
  tracer.recordBinary('kafka.topic', topic);
  tracer.recordBinary('kafka.partition', partition);
  if (typeof remoteServiceName !== 'undefined') {
    tracer.recordAnnotation(new Annotation.ServerAddr({serviceName: remoteServiceName}));
  }
  tracer.recordAnnotation(new Annotation.ConsumerStart());
  return id;
};

const recordConsumeStop = (tracer, id, error) => {
  tracer.letId(id, () => {
    if (typeof error !== 'undefined') {
      tracer.recordBinary('error', error.toString());
    }
    tracer.recordAnnotation(new Annotation.ConsumerStop());
  });
};

const recordProducerStart = (tracer, name, remoteServiceName, {topic}) => {
  tracer.setId(tracer.createChildId());
  const traceId = tracer.id;
  tracer.recordServiceName(tracer.localEndpoint.serviceName);
  tracer.recordRpc(name);
  tracer.recordBinary('kafka.topic', topic);
  if (typeof remoteServiceName !== 'undefined') {
    tracer.recordAnnotation(new Annotation.ServerAddr({serviceName: remoteServiceName}));
  }
  tracer.recordAnnotation(new Annotation.ProducerStart());
  return traceId;
};

const recordProducerStop = (tracer, id, error) => {
  tracer.letId(id, () => {
    if (error) {
      tracer.recordBinary('error', error.toString());
    }
    tracer.recordAnnotation(new Annotation.ProducerStop());
  });
};

module.exports = {
  recordConsumeStart,
  recordConsumeStop,
  recordProducerStart,
  recordProducerStop,
  bufferToAscii
};
