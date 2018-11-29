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
 * @property {string} serviceName
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
  constructor(grpc, {
    tracer = requiredArg('tracer'),
    serviceName = tracer.localEndpoint.serviceName,
    remoteServiceName
  }) {
    this.tracer = tracer;
    this.serviceName = serviceName;
    this.remoteServiceName = remoteServiceName;
  }

  /**
   * Appends zipking headers to gRPC metadata
   * @static
   * @param {grpc.Metadata} originalMetadata
   * @param {zipkin.TraceId} traceId
   * @return {grpc.Metadata}
   */
  static setHeaders(originalMetadata, traceId) {
    const metadata = originalMetadata.clone();
    metadata.add(HttpHeaders.TraceId, traceId.traceId);
    metadata.add(HttpHeaders.SpanId, traceId.spanId);

    traceId._parentId.ifPresent(psid => {
      metadata.add(HttpHeaders.ParentSpanId, psid);
    });
    traceId.sampled.ifPresent(sampled => {
      metadata.add(HttpHeaders.Sampled, sampled ? '1' : '0');
    });

    return metadata;
  }

  /**
   * Records start of RPC request
   * @param {grpc.Metadata} metadata
   * @param {string} method
   * @return {grpc.Metadata}
   */
  start(metadata, method) {
    this.tracer.setId(this.tracer.createChildId());
    const traceId = this.tracer.id;

    this.tracer.recordServiceName(this.serviceName);
    this.tracer.recordRpc(method);
    this.tracer.recordAnnotation(new Annotation.ClientSend());
    if (this.remoteServiceName) {
      this.tracer.recordAnnotation(new Annotation.ServerAddr({
        serviceName: this.remoteServiceName
      }));
    }

    return GrpcClientInstrumentation.setHeaders(metadata, traceId);
  }

  /**
   * Records end of RPC request
   * @param {zipkin.TraceId} traceId
   * @param {grpc.Status} status
   */
  onReceiveStatus(traceId, status) {
    const code = status.code.toString();
    this.tracer.setId(traceId);
    this.tracer.recordBinary('grpc.status_code', code);
    if (code !== '0') {
      this.tracer.recordBinary('error', code);
    }
    this.tracer.recordAnnotation(new Annotation.ClientRecv());
  }
}

module.exports = GrpcClientInstrumentation;
