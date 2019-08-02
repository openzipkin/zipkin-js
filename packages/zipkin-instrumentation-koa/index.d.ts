import {Middleware} from 'koa';
import {Tracer} from 'zipkin';

/**
 * When a request comes in, creates ServerRecv annotation and then passes
 * the request to the next middleware. When the final middleware finishes
 * the request, creates ServerSend annotation
 *
 * Sets the tracer.id to the span id prior to running the next middleware.
 *
 * Note that if the next middleware makes async calls, it should either
 * store the span id manually or use a CLSContext so that the annotations
 * go to the correct spans
 */
export declare function koaMiddleware(
  options: {tracer: Tracer, port?: number}
): Middleware;
