# zipkin

This is the core npm package for Zipkin. It contains the public API which is used by the various
plugins (instrumentations and transports).

We include TypeScript [definition file](index.d.ts) which you can also use as documentation.

## Developing

Please always make sure that [TypeScript type definitions](index.d.ts) match source code modifications.

## Usage

```javascript
const zipkin = require('zipkin');

// In Node.js, the recommended context API to use is zipkin-context-cls.
const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext(); // if you want to use CLS
const xtxImpl = new zipkin.ExplicitContext(); // Alternative; if you want to pass around the context manually

const tracer = new zipkin.Tracer({
  ctxImpl,
  recorder: new zipkin.ConsoleRecorder(), // For easy debugging. You probably want to use an actual implementation, like Kafka or Scribe.
  sampler: new zipkin.sampler.CountingSampler(0.01), // sample rate 0.01 will sample 1 % of all incoming requests
  traceId128Bit: true, // to generate 128-bit trace IDs. 64-bit (false) is default
  localServiceName: 'my-service' // indicates this node in your service graph
});
```

### Local tracing
Sometimes you have activity that precedes a remote request that you want to
capture in a trace. `tracer.local` can time an operation, placing a
corresponding span ID in scope so that any downstream commands end up in the
same trace.

Here's an example tracing a synchronous function:
```javascript
// A span representing checkout completes before result is returned
const result = tracer.local('checkout', () => {
  return someComputation();
});
```

Here's an example tracing a function that returns a promise:
```javascript
// A span is in progress and completes when the promise is resolved.
const result = tracer.local('checkout', () => {
  return createAPromise();
});
```
