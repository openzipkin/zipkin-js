import {Middleware} from 'koa';
import {Tracer} from 'zipkin';

/**
 * Creates a span id from the headers of an incoming request, or creates
 * a root span id if appropriate headers are not present in the request.
 *
 * Prior to invocation of next middleware records ServerRecv annotation.
 * When the final middleware finishes, records ServerSend annotation.
 *
 * Stores created span id in `_trace_id` property of `ctx.request`. If
 * {ExplicitContext} implementation is used, be sure to pass the context
 * to asynchronous callbacks that appear in other middleware using the
 * `ctx.request._trace_id` property. This is necessary to have annotations
 * recorded in correct spans.
 *
 * Alternatively, use {CLSContext} implementation.
 */
export declare function koaMiddleware(
  options: {tracer: Tracer, port?: number}
): Middleware;
