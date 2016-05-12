const {now} = require('./time');
const thriftTypes = require('./gen-nodejs/zipkinCore_types');
const {
  MutableSpan,
  Endpoint,
  ZipkinAnnotation,
  BinaryAnnotation
} = require('./internalRepresentations');
const {Sampler, alwaysSample} = require('./sampler');

function ZipkinTracer({
  logger,
  sampler = new Sampler(alwaysSample),
  timeout = 60 * 1000000 // default timeout = 60 seconds
  }) {
  const partialSpans = new Map();

  function writeSpan(id) {
    const spanToWrite = partialSpans.get(id);
    // ready for garbage collection
    partialSpans.delete(id);
    if (sampler.shouldSample(spanToWrite)) {
      logger.logSpan(spanToWrite);
    }
  }

  function updateSpanMap(id, updater) {
    let span;
    if (partialSpans.has(id)) {
      span = partialSpans.get(id);
    } else {
      span = new MutableSpan(id);
    }
    updater(span);
    if (span.complete) {
      writeSpan(id);
    } else {
      partialSpans.set(id, span);
    }
  }

  function timedOut(span) {
    return span.started + timeout < now();
  }

  // read through the partials spans regularly
  // and collect any timed-out ones
  setInterval(() => {
    partialSpans.forEach((span, id) => {
      if (timedOut(span)) {
        writeSpan(id);
      }
    });
  }, 1000);

  this.record = function record(rec) {
    const id = rec.traceId;

    updateSpanMap(id, span => {
      function annotate({timestamp}, value) {
        span.addAnnotation(new ZipkinAnnotation({
          timestamp,
          value
        }));
      }

      function binaryAnnotate(key, value) {
        span.addBinaryAnnotation(new BinaryAnnotation({
          key,
          value,
          annotationType: thriftTypes.AnnotationType.STRING
        }));
      }

      if (rec.annotation.annotationType === 'ClientSend') {
        annotate(rec, thriftTypes.CLIENT_SEND);
      } else if (rec.annotation.annotationType === 'ClientRecv') {
        annotate(rec, thriftTypes.CLIENT_RECV);
      } else if (rec.annotation.annotationType === 'ServerSend') {
        annotate(rec, thriftTypes.SERVER_SEND);
      } else if (rec.annotation.annotationType === 'ServerRecv') {
        annotate(rec, thriftTypes.SERVER_RECV);
      } else if (rec.annotation.annotationType === 'Message') {
        annotate(rec, rec.annotation.message);
      } else if (rec.annotation.annotationType === 'Rpc') {
        span.setName(rec.annotation.name);
      } else if (rec.annotation.annotationType === 'ServiceName') {
        span.setServiceName(rec.annotation.serviceName);
      } else if (rec.annotation.annotationType === 'BinaryAnnotation') {
        binaryAnnotate(rec.annotation.key, rec.annotation.value);
      } else if (rec.annotation.annotationType === 'LocalAddr') {
        span.setEndpoint(new Endpoint({
          host: rec.annotation.host.toInt(),
          port: rec.annotation.port
        }));
      }
    });
  };
}

module.exports = ZipkinTracer;
