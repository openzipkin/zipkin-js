const grpc = require('grpc');

const {
  Annotation
} = require('zipkin');

class ZipkinGrpcInterceptor {

  constructor(tracer) {
    this.tracer = tracer;
  }

  beforeGrpcCall({serviceName = 'unknown', remoteGrpcServiceName = 'unknown', xB3Sampled = '0', grpcMetadata}) {
    return this.tracer.scoped(() => {
      let metadata;

      if (grpcMetadata && grpcMetadata instanceof grpc.Metadata) {
        metadata = grpcMetadata;
      } else {
        metadata = new grpc.Metadata();
      }

      const parentSpanIds = this.tracer.id;
      const newSpanIds = this.tracer.createChildId();

      metadata.add('X-B3-TraceId', parentSpanIds.traceId);
      metadata.add('X-B3-ParentSpanId', parentSpanIds.spanId);
      metadata.add('X-B3-SpanId', newSpanIds.spanId);
      metadata.add('X-B3-Sampled', xB3Sampled);

      this.traceId = newSpanIds;

      this.tracer.setId(newSpanIds);
      this.tracer.recordServiceName(serviceName);
      this.tracer.recordRpc(remoteGrpcServiceName);

      this.tracer.recordAnnotation(new Annotation.ClientSend());
      this.tracer.recordAnnotation(new Annotation.LocalAddr({}));

      return metadata;
    });
  }

  afterGrpcCall() {
    this.tracer.scoped(() => {
      this.tracer.setId(this.traceId);
      this.tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }

}

module.exports = ZipkinGrpcInterceptor;
