import {Tracer} from 'zipkin';

declare function wrapGot(got: any, {
  tracer: Tracer,
  serviceName: string,
  remoteServiceName: string
}): any;

export default wrapGot;
