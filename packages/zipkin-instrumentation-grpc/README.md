# zipkin-instrumentation-grpc

This lib is the interceptor for [Zipkin](https://github.com/openzipkin/zipkin) to intercept your [GRPC](https://github.com/grpc/grpc) calls(unary/stream).

## Project test status

- [x] Tested with Node.js GRPC client <-> Node.js GRPC server

- [x] Tested with Node.js GRPC client <-> Go GRPC server

## How to use

* Init Zipkin GRPC interceptor

  ```javascript
  // Your zipkin base url, like: http://localhost:65534
  const zipkinBaseUrl = 'YOUR_ZIPKIN_BASE_URL';

  const CLSContext = require('zipkin-context-cls');

  const {Tracer, BatchRecorder, ConsoleRecorder} = require('zipkin');
  const {HttpLogger} = require('zipkin-transport-http');

  const recorder = new BatchRecorder({
    logger: new HttpLogger({
      endpoint: `${zipkinBaseUrl}/api/v1/spans`
    })
  });

  // `ConsoleRecorder` will be very helpful when you want to debug where is going wrong.
  // const recorder = new ConsoleRecorder();

  const ctxImpl = new CLSContext('zipkin');

  const tracer = new Tracer({ctxImpl, recorder});

  global.ZIPKIN_GRPC_INTCP = new (require('zipkin-instrumentation-grpc'))(tracer);
  ```

* Right before your GRPC client is ready to call the remote GRPC service

  ```javascript
  const metadata = global.ZIPKIN_GRPC_INTCP.beforeClientDoGrpcCall({
    serviceName: process.env.MS_SERVICE_TAG,
    remoteGrpcServiceName: 'signInV1',
    xB3Sampled: '1'
  });

  // Then do your GRPC call
  yourGrpcClient.remoteGrpcService(reqBody, metadata, (err, resData) => {
    // Your business logic as before ...
  });
  ```

* Upon your GRPC server received the call from your GRPC client

  ```javascript
  // Apparently you need to initialize the `ZIPKIN_GRPC_INTCP` for each of your distributed GRPC service.

  // Do this at the first line upon the GRPC server received the call from the GRPC client.
  global.ZIPKIN_GRPC_INTCP.uponServerRecvGrpcCall({
    serviceName: process.env.MS_SERVICE_TAG,
    grpcMetadataFromIncomingCtx: call.metadata
  });
  ```
* Upon your GRPC server has finished all the respond.

  ```javascript
  // Do this upon your GRPC server has finished all the respond.
  global.ZIPKIN_GRPC_INTCP.uponServerFinishRespond();
  ```

* After everything of this GRPC call has been finished at your GRPC client.

  ```javascript
  global.ZIPKIN_GRPC_INTCP.afterGrpcCallFinish();
  ```

* For GRPC server side is written in GO.

  ```go
  func initTracerForZipkin(zipkinUrl, hostPort, serviceName string) {
    if collector, e := zipkin.NewHTTPCollector(zipkinUrl); e == nil {
      if tracer, e0 := zipkin.NewTracer(zipkin.NewRecorder(collector, false, hostPort, serviceName)); e0 == nil {
        opentracing.InitGlobalTracer(tracer)
      } else {
        util.Logger.Panic("Could not init tracer for Zipkin.")
        panic(e0)
      }
    } else {
      util.Logger.Panic("Could not init collector for Zipkin.")
      panic(e)
    }
  }

  func main() {
    hostname, _ := os.Hostname()

    initTracerForZipkin("YOUR_ZIPKIN_BASE_URL/api/v1/spans", hostname, os.Getenv("MS_SERVICE_TAG"))
  }

  // Utils
  type metadataReader struct {
    *metadata.MD
  }

  func (mr metadataReader) ForeachKey(handler func(key, val string) error) error {
    for k, vals := range *mr.MD {
      for _, v := range vals {
        if e := handler(k, v); e != nil {
          return e
        }
      }
    }
    return nil
  }

  func getIncomingCtxFromGRPC(ctx context.Context, tracer opentracing.Tracer, opName string) context.Context {
    md, _ := metadata.FromIncomingContext(ctx)

    if incomingCtx, e := tracer.Extract(opentracing.TextMap, metadataReader{&md}); e == nil && e != opentracing.ErrSpanContextNotFound {
      span := tracer.StartSpan(opName, ext.RPCServerOption(incomingCtx))
      return opentracing.ContextWithSpan(ctx, span)
    } else {
      util.Logger.Panic("Opentracing tracer could not extract metadata from incoming context.")
      panic(e)
    }
  }

  // In actual service.
  ctx := getIncomingCtxFromGRPC(stream.Context(), opentracing.GlobalTracer(), "LsyncV1")

  if span := opentracing.SpanFromContext(ctx); span != nil {
    defer span.Finish()

    ext.SpanKindRPCServer.Set(span)
    span.SetTag("serviceType", "Go GRPC")
  }
  ```

## Maintainer

Feel free to `@lnshi` on Github for any issue of this lib 🙂
