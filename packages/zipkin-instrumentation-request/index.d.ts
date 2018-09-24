import {CoreOptions, Request, RequestAPI} from 'request';
import {Tracer} from 'zipkin';

/**
 * Wraps the request (or request-promise) api with HttpClient instrumentation
 *
 * Note: you may have to explicitly provide the generic types from request
 * or request-promise to make the TypeScript compiler happy e.g., for request,
 *
 *     tracingRequest = wrapRequest<
 *        request.Request, request.CoreOptions, request.RequiredUriUrl
 *        >(request, {tracer})
 *
 * or, for request-promise,
 *
 *     tracingRequest = wrapRequest<
 *        rp.RequestPromise, rp.RequestPromiseOptions, request.RequiredUriUrl
 *        >(rp, {tracer})
 */
declare function wrapRequest<TRequest extends Request, TOptions extends CoreOptions, TUriUrlOptions>(
  request: RequestAPI<TRequest, TOptions, TUriUrlOptions>,
  options: {tracer: Tracer, remoteServiceName?: string}
): RequestAPI<TRequest, TOptions, TUriUrlOptions>;

export = wrapRequest;
