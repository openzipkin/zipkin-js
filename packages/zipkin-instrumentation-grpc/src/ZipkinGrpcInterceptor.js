const grpc = require('grpc');

const {
  TraceId,
  Annotation,
  option: {Some}
} = require('zipkin');

class ZipkinGrpcInterceptor {

  constructor(tracer) {
    this.tracer = tracer;
  }

  // Call this right before the GRPC client is ready to call the GRPC server service.
  beforeClientDoGrpcCall({serviceName = 'unknown', remoteGrpcServiceName = 'unknown', xB3Sampled = '0', grpcMetadata}) {
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

  // Call this at the first line upon the GRPC server received the call from the GRPC client side.
  uponServerRecvGrpcCall({serviceName = 'unknown', grpcMetadataFromIncomingCtx}) {
    if (!grpcMetadataFromIncomingCtx || !(grpcMetadataFromIncomingCtx instanceof grpc.Metadata)) {
      throw new Error("The parameter 'grpcMetadataFromIncomingCtx' must be instance of 'grpc.Metadata'");
    }

    const [ctxTraceId, ctxParentId, ctxSpanId] = [
      grpcMetadataFromIncomingCtx.get('x-b3-traceid')[0],
      grpcMetadataFromIncomingCtx.get('x-b3-parentspanid')[0],
      grpcMetadataFromIncomingCtx.get('x-b3-spanid')[0]
    ];

    if (!ctxTraceId || !ctxParentId || !ctxSpanId) {
      throw new Error("Incoming X-B3 metadata corrupted, missing one of 'X-B3-TraceId', 'X-B3-ParentSpanId' or 'X-B3-SpanId'.");
    }

    let ctxSampled = grpcMetadataFromIncomingCtx.get('x-b3-sampled')[0];
    if (!(ctxSampled in ['0', '1'])) {
      ctxSampled = '0'
    }

    const ctxTraceInfo = new TraceId({
      traceId: new Some(ctxTraceId),
      parentId: new Some(ctxParentId),
      spanId: ctxSpanId,
      sampled: new Some(ctxSampled)
    });

    this.tracer.scoped(() => {
      this.traceId = ctxTraceInfo;

      this.tracer.setId(ctxTraceInfo);
      this.tracer.recordServiceName(serviceName);

      this.tracer.recordAnnotation(new Annotation.ServerRecv());
      this.tracer.recordAnnotation(new Annotation.LocalAddr({}));
    });
  }

  // Call this right before the GRPC server finish all respond.
  uponServerFinishRespond() {
    this.tracer.scoped(() => {
      this.tracer.setId(this.traceId);
      this.tracer.recordAnnotation(new Annotation.ServerSend());
    });
  }

  // Call this right after everything of this GRPC call be finished at GRPC client side.
  afterGrpcCallFinish() {
    this.tracer.scoped(() => {
      this.tracer.setId(this.traceId);
      this.tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }

}

module.exports = ZipkinGrpcInterceptor;
