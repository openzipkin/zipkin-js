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
  beforeClientDoGrpcCall({serviceName = 'unknown', remoteGrpcServiceName = 'unknown',
                            grpcMetadata}) {
    return this.tracer.scoped(() => {
      let metadata;

      if (grpcMetadata && grpcMetadata instanceof grpc.Metadata) {
        metadata = grpcMetadata;
      } else {
        metadata = new grpc.Metadata();
      }

      this.tracer.setId(this.tracer.createChildId());

      this.traceId = this.tracer.id;

      metadata.add('X-B3-TraceId', this.tracer.id.traceId);
      metadata.add('X-B3-ParentSpanId', this.tracer.id.parentId);
      metadata.add('X-B3-SpanId', this.tracer.id.spanId);
      metadata.add('X-B3-Sampled', this.tracer.id.sampled.getOrElse() ? '1' : '0');

      this.tracer.recordServiceName(serviceName);
      this.tracer.recordRpc(remoteGrpcServiceName);

      this.tracer.recordAnnotation(new Annotation.ClientSend());
      this.tracer.recordAnnotation(new Annotation.LocalAddr({}));

      return metadata;
    });
  }

  // Call this at the first line upon the GRPC server received the call from the GRPC client.
  uponServerRecvGrpcCall({serviceName = 'unknown', grpcMetadataFromIncomingCtx}) {
    if (!grpcMetadataFromIncomingCtx || !(grpcMetadataFromIncomingCtx instanceof grpc.Metadata)) {
      // Should fail silently here, without possibly breaking the actual service call stack.
      return;
    }

    const [ctxTraceId, ctxParentId, ctxSpanId] = [
      grpcMetadataFromIncomingCtx.get('x-b3-traceid')[0],
      grpcMetadataFromIncomingCtx.get('x-b3-parentspanid')[0],
      grpcMetadataFromIncomingCtx.get('x-b3-spanid')[0]
    ];

    if (!ctxTraceId || !ctxParentId || !ctxSpanId) {
      // Should fail silently here, without possibly breaking the actual service call stack.
      return;
    }

    let ctxSampled = grpcMetadataFromIncomingCtx.get('x-b3-sampled')[0];
    if (!(ctxSampled in ['0', '1'])) {
      ctxSampled = '0';
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

  // Call this right before the GRPC server has finished all respond.
  uponServerFinishRespond() {
    this.tracer.scoped(() => {
      this.tracer.setId(this.traceId);
      this.tracer.recordAnnotation(new Annotation.ServerSend());
    });
  }

  // Call this right after everything of this GRPC call has been finished at GRPC client.
  afterGrpcCallFinish() {
    this.tracer.scoped(() => {
      this.tracer.setId(this.traceId);
      this.tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }

}

module.exports = ZipkinGrpcInterceptor;
