// TypeScript type definitions
//
// After modifying project's source code make appropriate changes to this file,
// especially when you do one of the following:
//  - add/remove/rename a class
//  - add/remove/rename a method
//  - change method signature
//
declare namespace zipkin {
  interface Context<T> {
    setContext(ctx: T): void;
    getContext(): T;
    scoped<V>(callback: () => V): V;
    letContext<V>(ctx: T, callback: () => V): V;
  }

  namespace sampler {
    class Sampler {
      constructor(evaluator: (traceId: TraceId) => boolean);
      shouldSample(traceId: TraceId): option.IOption<boolean>
    }

    class CountingSampler implements Sampler {
      constructor(sampleRate?: number);
      shouldSample(traceId: TraceId): option.IOption<boolean>
    }

    const neverSample: (traceId: TraceId) => boolean;
    const alwaysSample: (traceId: TraceId) => boolean;
  }

  class Tracer {
    constructor(args: { ctxImpl: Context<TraceId>, recorder: Recorder, sampler?: sampler.Sampler, traceId128Bit?: boolean, localServiceName?: string, localEndpoint?: model.Endpoint });
    id: TraceId;

    scoped<V>(callback: () => V): V;
    local<V>(name: string, callback: () => V): V;
    createRootId(): TraceId;
    createChildId(): TraceId;
    letId<V>(traceId: TraceId, callback: () => V): V;
    setId(traceId: TraceId): void;
    recordAnnotation(annotation: IAnnotation): void;
    recordMessage(message: any): void;
    recordServiceName(serviceName: any): void;
    recordRpc(name: any): void;
    recordClientAddr(inetAddress: InetAddress): void;
    recordServerAddr(inetAddress: InetAddress): void;
    recordLocalAddr(inetAddress: InetAddress): void;
    recordBinary(key: string, value: boolean | string | number): void;
    writeIdToConsole(message: any): void;
  }

  class TraceId {
    _traceId:  option.IOption<string>;
    _parentId: option.IOption<string>;
    _spanId:   string;
    _sampled:  option.IOption<boolean>;
    _flags:    number;

    readonly traceId: string;
    readonly parentId: string;
    readonly spanId: string;
    readonly sampled: option.IOption<boolean>;
    readonly flags: number;

    isDebug(): boolean;

    constructor(args?: {
      traceId?:  option.IOption<string>,
      parentId?: option.IOption<string>,
      spanId?:   string,
      sampled?:  option.IOption<string>,
      flags?:    number
    });
    isDebug(): boolean;
    toString(): string;
  }

  const createNoopTracer: () => void;

  namespace option {
    interface IOption<T> {
      type: "Some" | "None";
      present: boolean;

      map: <V>(fn: (value: T) => V) => IOption<V>;
      ifPresent: <V>(fn: (value: T) => V) => IOption<V>;
      flatMap: <V>(fn: (value: T) => V) => IOption<V>;
      getOrElse: <V>(fnOrValue: (() => V) | V) => T;
      equals: (other: IOption<T>) => boolean;
      toString: () => string;
    }

    interface INone extends IOption<any> {
      type: "None";
      present: false;

      map: <V>(fn: (value: any) => V) => INone;
      flatMap: <V>(fn: (value: any) => V) => INone;
      equals: (other: IOption<any>) => boolean;
      toString: () => string;
    }

    const None: INone;

    class Some<T> implements IOption<T> {
      constructor(value: T);
      type: "Some" | "None";
      present: true;

      map: <V>(fn: (value: T) => V) => IOption<V>;
      ifPresent: <V>(fn: (value: T) => V) => IOption<V>;
      flatMap: <V>(fn: (value: T) => V) => IOption<V>;
      getOrElse: () => T;
      equals: (other: IOption<T>) => boolean;
      toString: () => string;
    }
  }

  namespace model {
    class Endpoint {
      constructor(args: { serviceName?: string, ipv4?: string, port?: number });

      setServiceName(serviceName: string): void;
      setIpv4(ipv4: string): void;
      setPort(port: number): void;

      isEmpty(): void;
    }

    interface Annotation {
      timestamp: number;
      value: string;
    }

    class Span {
      readonly traceId:        string;
      readonly parentId?:      string;
      readonly id:             string;
      readonly name?:           string;
      readonly kind?:           string;
      readonly timestamp?:      number;
      readonly duration?:       number;
      readonly localEndpoint?:  Endpoint;
      readonly remoteEndpoint?: Endpoint;
      readonly annotations:    Annotation[];
      readonly tags:           { [ key: string ]: string };
      readonly debug:          boolean;
      readonly shared:         boolean;

      constructor(traceId: TraceId)
      setName(name: string): void;
      setKind(kind: string): void;
      setTimestamp(timestamp: number): void;
      setDuration(duration: number): void;
      setLocalEndpoint(endpoint: Endpoint): void;
      setRemoteEndpoint(endpoint: Endpoint): void;
      addAnnotation(timestamp: number, value: string): void;
      putTag(key: string, value: string): void;
      setDebug(debug: boolean): void;
      setShared(shared: boolean): void;
    }
  }

  /** Used by the HttpLogger transport to convert spans to JSON */
  interface JsonEncoder {
    encode: (span: model.Span) => string;
  }

  namespace jsonEncoder {
    const JSON_V1: JsonEncoder;
    const JSON_V2: JsonEncoder;
  }

  interface IAnnotation {
    readonly annotationType: string
  }

  namespace Annotation {
    class ClientSend implements IAnnotation {
      readonly annotationType: string;
    }
    class ClientRecv implements IAnnotation {
      readonly annotationType: string;
    }
    class ServerSend implements IAnnotation {
      readonly annotationType: string;
    }
    class ServerRecv implements IAnnotation {
      readonly annotationType: string;
    }

    class Message implements IAnnotation {
      constructor(message: string);
      readonly annotationType: string;
      message: string;
    }

    class ServiceName implements IAnnotation {
      constructor(serviceName: string);
      readonly annotationType: string;
      serviceName: string;
    }

    class Rpc implements IAnnotation {
      constructor(name: string);
      readonly annotationType: string;
      name: string;
    }

    class ClientAddr implements IAnnotation {
      constructor(args: { host: InetAddress, port: number });
      readonly annotationType: string;
    }

    class ServerAddr implements IAnnotation {
      constructor(args: { serviceName: string, host?: InetAddress, port?: number });
      readonly annotationType: string;
      serviceName: string
      host: InetAddress;
      port: number;
    }

    class LocalAddr implements IAnnotation {
      constructor(args?: { host?: InetAddress, port?: number });
      readonly annotationType: string;
      host: InetAddress;
      port: number;
    }

    class BinaryAnnotation implements IAnnotation {
      constructor(key: string, value: boolean | string | number);
      readonly annotationType: string;
      key: string;
      value: string;
    }
  }

  class InetAddress {
    constructor(addr: string);
    static getLocalAddress(): InetAddress;

    ipv4(): string;
    toInt(): number;
  }

  namespace HttpHeaders {
    const TraceId: string;
    const SpanId: string;
    const ParentSpanId: string;
    const Sampled: string;
    const Flags: string;
  }

  interface Record {
    traceId: TraceId;
    timestamp: number;
    annotation: IAnnotation
  }

  /** The Tracer sends each annotation to a Recorder implementation */
  interface Recorder {
    record: (rec: Record) => void;
  }

  class BatchRecorder implements Recorder {
    constructor(args: { logger: Logger, timeout?: number });
    record: (rec: Record) => void;
  }

  class ConsoleRecorder implements Recorder {
    constructor(args?: { logger?: Logger });
    record: (rec: Record) => void;
  }

  class ExplicitContext implements Context<TraceId> {
    setContext(ctx: TraceId): void;
    getContext(): TraceId;
    scoped<V>(callback: () => V): V;
    letContext<V>(ctx: TraceId, callback: () => V): V;
  }

  namespace Request {
    function addZipkinHeaders(req: {headers: any}, traceId: TraceId): void;
  }

  /** The Logger (or transport) is what the Recorder uses to send spans to Zipkin.
   * @see https://github.com/openzipkin/zipkin-js/#transports Official transport implementations
   */
  interface Logger {
    logSpan(span: model.Span): void;
  }

  namespace Instrumentation {
    class HttpServer {
      constructor(args: { tracer: Tracer, port: number });

      recordRequest(
        method: string,
        requestUrl: string,
        readHeader: <T> (header: string) => option.IOption<T>
      ): string;
      recordResponse(traceId: string, statusCode: string, error?: Error): void;
    }

    class HttpClient {
      constructor(args: { tracer: Tracer, remoteServiceName?: string });

      recordRequest<T>(
        request: T,
        url: string,
        method: string
      ): T;
      recordResponse(traceId: string, statusCode: string): void;
      recordError(traceId: string, error: Error): void;
    }
  }
}

export = zipkin;
