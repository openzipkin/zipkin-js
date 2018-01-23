import {Tracer} from "zipkin"
import {Handler} from "express"

/**
 * When a request comes in, creates ServerRecv annotation and then passes
 * the request to the next middlewhare. When the final middleware finishes
 * the request, creates ServerSend annotation
 *
 * Sets the tracer.id to the span id prior to running the next middleware.
 *
 * Note that if the next middleware makes async calls, it should either
 * store the span id manually or use a CLSContext so that the annotations
 * go to the correct spans
 */
export declare function expressMiddleware(
  options: {tracer: Tracer, port?: number}
): Handler;

export declare function wrapExpressHttpProxy(
  proxy: (host: string, options?: any) => Handler,
  options: {tracer: Tracer, remoteServiceName?: string}
): (host: string, options?: any) => Handler
