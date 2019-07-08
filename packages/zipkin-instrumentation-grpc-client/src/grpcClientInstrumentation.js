const {Annotation, HttpHeaders} = require('zipkin');

/**
 * @private
 * @param {string} name
 * @throws Error
 */
function requiredArg(name) {
  throw new Error(`GrpcClientInstrumentation: Missing required argument ${name}.`);
}

/**
 * @namespace grpc
 */

/**
 * @typedef {Object} grpc.Status
 * @memberof grpc
 * @property {function()} clone
 * @property {function(key: string, value: string)} add
 */

/**
 * @typedef {Object} grpc.Metadata
 * @memberof grpc
 * @property {function()} clone
 * @property {function(key: string, value: string)} add
 */

/**
 * @typedef {Object} GrpcClientContext
 * @property {zipkin.Tracer} tracer
 * @property {string} remoteServiceName
 */

/**
 * @class GrpcClientInstrumentation
 */
class GrpcClientInstrumentation {
  /**
   * @constructor
   * @param {Object} grpc
   * @param {GrpcClientContext} context
   */
  constructor(grpc, {tracer = requiredArg('tracer'), remoteServiceName}) {
    this.grpc = grpc;
    this.tracer = tracer;
    this.serviceName = tracer.localEndpoint.serviceName;
    this.remoteServiceName = remoteServiceName;
  }

  /**
   * Appends zipkin headers to gRPC metadata
   * @static
   * @param {grpc.Metadata} originalMetadata
   * @param {zipkin.TraceId} traceId
   * @return {grpc.Metadata}
   */
  static setHeaders(originalMetadata, traceId) {
    const metadata = originalMetadata.clone();
    metadata.add(HttpHeaders.TraceId, traceId.traceId);
    metadata.add(HttpHeaders.SpanId, traceId.spanId);

    traceId.parentSpanId.ifPresent((psid) => {
      metadata.add(HttpHeaders.ParentSpanId, psid);
    });
    traceId.sampled.ifPresent((sampled) => {
      metadata.add(HttpHeaders.Sampled, sampled ? '1' : '0');
    });
    if (traceId.isDebug()) {
      metadata.add(HttpHeaders.Flags, '1');
    }

    return metadata;
  }

  /**
   * Records start of RPC request
   * @param {grpc.Metadata} metadata
   * @param {string} method
   * @return {zipkin.TraceId}
   */
  start(metadata, method) {
    const traceId = this.tracer.createChildId();

    this.tracer.letId(traceId, () => {
      this.tracer.recordServiceName(this.serviceName);
      this.tracer.recordRpc(method);
      this.tracer.recordAnnotation(new Annotation.ClientSend());
      if (this.remoteServiceName) {
        this.tracer.recordAnnotation(new Annotation.ServerAddr({
          serviceName: this.remoteServiceName
        }));
      }
    });

    return traceId;
  }

  /**
   * Records end of RPC request
   * @param {zipkin.TraceId} traceId
   * @param {grpc.Status} status
   */
  onReceiveStatus(traceId, status) {
    const {code} = status; // TODO: In brave this is a string like UNKNOWN not a number
    this.tracer.letId(traceId, () => {
      if (code !== this.grpc.status.OK) {
        this.tracer.recordBinary('grpc.status_code', String(code));
        this.tracer.recordBinary('error', status.details || String(code));
      }
      this.tracer.recordAnnotation(new Annotation.ClientRecv());
    });
  }
}

module.exports = GrpcClientInstrumentation;
