import {Tracer} from 'zipkin';

declare function wrapFetch(fetch: any, {
  tracer: Tracer,
  serviceName: string,
  remoteServiceName: string
}): any;

export default wrapFetch;
