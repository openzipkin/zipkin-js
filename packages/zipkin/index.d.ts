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
      shouldSample(traceId: TraceId): option.IOption<boolean>;
    }

    class CountingSampler implements Sampler {
      constructor(sampleRate?: number);
      shouldSample(traceId: TraceId): option.IOption<boolean>;
    }

    const neverSample: (traceId: TraceId) => boolean;
    const alwaysSample: (traceId: TraceId) => boolean;
  }

  class Tracer {
    constructor(args: {
      ctxImpl: Context<TraceId>,
      recorder: Recorder,
      sampler?: sampler.Sampler,
      supportsJoin?: boolean,
      traceId128Bit?: boolean,
      localServiceName?: string,
      localEndpoint?: model.Endpoint,
      log?: Console,
      defaultTags?: {}
    });

    /** Returns the current trace ID or a sentinel value indicating its absence. */
    id: TraceId;

    scoped<V>(callback: () => V): V;
    local<V>(name: string, callback: () => V): V;
    createRootId(isSampled?: option.IOption<boolean>, isDebug?: boolean): TraceId;
    /** Creates a child of the current trace ID or a new root span. */
    createChildId(parentId?: TraceId): TraceId;
    letId<V>(traceId: TraceId, callback: () => V): V;
    setId(traceId: TraceId): void;
    recordAnnotation(annotation: IAnnotation, timestamp?: number): void;
    recordMessage(message: string): void;
    recordServiceName(serviceName: string): void;
    recordRpc(name: string): void;
    recordClientAddr(inetAddress: InetAddress): void;
    recordServerAddr(inetAddress: InetAddress): void;
    recordLocalAddr(inetAddress: InetAddress): void;
    recordBinary(key: string, value: boolean | string | number): void;
    writeIdToConsole(message: any): void;
  }

  class TraceId {
    readonly traceId: string;
    readonly parentSpanId: option.IOption<string>;
    readonly spanId: string;
    readonly sampled: option.IOption<boolean>;

    isDebug(): boolean;
    isShared(): boolean;

    constructor(args?: {
      traceId?: string,
      parentId?: option.IOption<string>,
      spanId?: string,
      sampled?: option.IOption<boolean>,
      debug?: boolean,
      shared?: boolean
    });

    toString(): string;
  }

  const createNoopTracer: () => void;
  const randomTraceId: () => string;

  namespace option {
    abstract class Option<T> {
      map<V>(fn: (value: T) => V): IOption<V>;
      ifPresent(fn: (value: T) => any): void;
      flatMap<V>(fn: (value: T) => IOption<V>): IOption<V>;
      getOrElse(fnOrValue: (() => T) | T): T;
      equals(other: IOption<T>): boolean;
      toString(): string;
    }

    class Some<T> extends Option<T> {
      constructor(value: T);
      readonly type: 'Some';
      readonly present: true;
    }

    interface INone<T> extends Option<T> {
      readonly type: 'None';
      readonly present: false;
    }

    type IOption<T> = Some<T> | INone<T>;

    const None: INone<never>;

    function isOptional(data: any): boolean;
    function verifyIsOptional(data: any): void; // Throw error is not a valid option
    function fromNullable<V>(nullable: V): IOption<V>;
  }

  namespace model {
    class Endpoint {
      constructor(args: { serviceName?: string, ipv4?: string, port?: number });

      setServiceName(serviceName: string): void;
      setIpv4(ipv4: string): void;
      setPort(port: number): void;

      isEmpty(): boolean;
    }

    interface Annotation {
      timestamp: number;
      value: string;
    }

    class Span {
      readonly traceId: string;
      readonly parentId?: string;
      readonly id: string;
      readonly name?: string;
      readonly kind?: string;
      readonly timestamp?: number;
      readonly duration?: number;
      readonly localEndpoint?: Endpoint;
      readonly remoteEndpoint?: Endpoint;
      readonly annotations: Annotation[];
      readonly tags: { [ key: string ]: string };
      readonly debug: boolean;
      readonly shared: boolean;

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
    encode(span: model.Span): string;
  }

  namespace jsonEncoder {
    const JSON_V1: JsonEncoder;
    const JSON_V2: JsonEncoder;
  }

  interface IAnnotation {
    readonly annotationType: string;
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
    class ProducerStart implements IAnnotation {
      readonly annotationType: string;
    }
    class ProducerStop implements IAnnotation {
      readonly annotationType: string;
    }
    class ConsumerStart implements IAnnotation {
      readonly annotationType: string;
    }
    class ConsumerStop implements IAnnotation {
      readonly annotationType: string;
    }
    class MessageAddr implements IAnnotation {
      constructor(args: { serviceName: string, host?: InetAddress, port?: number });
      readonly annotationType: string;
      serviceName: string;
      host: InetAddress;
      port: number;
    }
    class LocalOperationStart implements IAnnotation {
      constructor(name: string);
      readonly annotationType: string;
      name: string;
    }
    class LocalOperationStop implements IAnnotation {
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
      serviceName: string;
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
      constructor(key: string, value: string);
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
    annotation: IAnnotation;
  }

  /** The Tracer sends each annotation to a Recorder implementation */
  interface Recorder {
    record(rec: Record): void;
  }

  class BatchRecorder implements Recorder {
    /**
     * @constructor
     * @param {Object} args
     * @param {Logger} args.logger logs the data to zipkin server
     * @param {number} args.timeout timeout after which an unfinished span is
     * flushed to zipkin in **microseconds**. Passing this value has
     * implications in the reported data of the span so we discourage users
     * to pass a value for it unless there is a good reason for.
     */
    constructor(args: { logger: Logger, timeout?: number });
    record: (rec: Record) => void;
    flush: () => void;
  }

  class ConsoleRecorder implements Recorder {
    constructor(logger?: (message: string) => void);
    record: (rec: Record) => void;
  }

  class ExplicitContext implements Context<TraceId> {
    setContext(ctx: TraceId): void;
    getContext(): TraceId;
    scoped<V>(callback: () => V): V;
    letContext<V>(ctx: TraceId, callback: () => V): V;
  }

  type RequestZipkinHeaders<T = any, H = any> = T & {
    headers: H & {
      ['X-B3-TraceId']: string;
      ['X-B3-SpanId']: string;
      ['X-B3-ParentSpanId']?: string;
      ['X-B3-Sampled']?: '1' | '0';
      ['X-B3-Flags']?: '1' | '0';
    };
  };

  namespace Request {
    function addZipkinHeaders<T, H>(req: T & { headers?: any }, traceId: TraceId): RequestZipkinHeaders<T, H>;
  }

  /** The Logger (or transport) is what the Recorder uses to send spans to Zipkin.
   * @see https://github.com/openzipkin/zipkin-js/#transports Official transport implementations
   */
  interface Logger {
    logSpan(span: model.Span): void;
  }

  namespace Instrumentation {
    class HttpServer {
      constructor(args: {
        tracer: Tracer,
        port: number,
        serviceName?: string,
        host?: string,
        serverTags?: {[key: string]: string}
      });

      recordRequest(
        method: string,
        requestUrl: string,
        readHeader: <T> (header: string) => option.IOption<T>
      ): TraceId;
      recordResponse(traceId: TraceId, statusCode: string, error?: Error): void;
    }

    class HttpClient {
      constructor(args: { tracer: Tracer, serviceName?: string, remoteServiceName?: string });

      recordRequest<T>(
        request: T,
        url: string,
        method: string
      ): T;
      recordResponse(traceId: TraceId, statusCode: string): void;
      recordError(traceId: TraceId, error: Error): void;
    }
  }
}

export = zipkin;
