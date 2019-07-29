import {Tracer} from 'zipkin';

// ResponseReader allows the user to customize the response based on
// the response. In order to not to leak context, user should
// bind this to `instrumentation`. An example use case for such
// feature is read response header to know if the response comes
// was cached or not.
type ResponseReader = (traceId: string, res: any) => void

declare function wrapFetch(got: any, {
  tracer: Tracer,
  serviceName: string,
  remoteServiceName: string,
  responseReader: ResponseReader
}): any;

export default wrapFetch;
