import {Tracer} from 'zipkin';

declare function wrapFetch(got: any, {
  tracer: Tracer,
  serviceName: string,
  remoteServiceName: string
}): any;

export default wrapFetch;
