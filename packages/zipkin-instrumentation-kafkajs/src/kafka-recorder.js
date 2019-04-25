const {TraceId, option: {Some}, Annotation, HttpHeaders} = require('zipkin');

const recordConsumeStart = (tracer, {topic, partition, message}) => {
  const spanId = message.headers[HttpHeaders.SpanId];
  let id;

  if (spanId) {
    const parentId = message.headers[HttpHeaders.ParentSpanId];
    const traceId = message.headers[HttpHeaders.TraceId];
    const sampled = message.headers[HttpHeaders.Sampled];
    const flags = message.headers[HttpHeaders.Flags];

    id = tracer.join(new TraceId({
      traceId: new Some(traceId ? traceId.toString() : null),
      parentId: new Some(parentId ? parentId.toString() : null),
      spanId: spanId.toString(),
      sampled: new Some(sampled ? sampled.toString() : null),
      flags: flags ? parseInt(flags) : 0
    }));
  } else {
    id = tracer.createRootId();
  }

  tracer.setId(id);
  tracer.recordServiceName(tracer.localEndpoint.serviceName);
  tracer.recordRpc('consume');
  tracer.recordBinary('kafka.topic', topic);
  tracer.recordBinary('kafka.partition', partition);
  tracer.recordAnnotation(new Annotation.ConsumerStart());
  return id;
};

const recordConsumeStop = (tracer, id, error) => {
  tracer.letId(id, () => {
    if (error) {
      tracer.recordBinary('error', error.toString());
    }
    tracer.recordAnnotation(new Annotation.ConsumerStop());
  });
};

const recordProducerStart = (tracer, remoteServiceName, {topic}) => {
  tracer.setId(tracer.createChildId());
  const traceId = tracer.id;
  tracer.recordServiceName(remoteServiceName);
  tracer.recordRpc('produce');
  tracer.recordBinary('kafka.topic', topic);
  tracer.recordAnnotation(new Annotation.ProducerStart());
  tracer.recordAnnotation(new Annotation.ServerAddr({
    serviceName: remoteServiceName
  }));
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
  recordProducerStop
};
