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

// Tracer will be a one to many relationship with instrumentation that use it (like express)
const tracer = new zipkin.Tracer({
  ctxImpl, // the in-process context
  recorder: new zipkin.ConsoleRecorder(), // For easy debugging. You probably want to use an actual implementation, like Kafka or AWS SQS.
  sampler: new zipkin.sampler.CountingSampler(0.01), // sample rate 0.01 will sample 1 % of all incoming requests
  traceId128Bit: true, // to generate 128-bit trace IDs. 64-bit (false) is default
  localServiceName: 'my-service' // indicates this node in your service graph
});
```

### In-process context (node only)

The event loop is what allows Node.js to perform non-blocking I/O operations, hence
several operations are happening at the same time and we need a way to correlate different operations that happen at the same time to a specific trace. There are two options for this: explicit and implicit context.

In the **explicit context**, we pass around an object `ctx` from the top layer of the application down to those operations we want to trace. For example, a `ctx` will be handed from the HTTP handler down to the application layer and finally to a HTTP call that queries external resources.

In the **implicit context**, we don't need to pass anything, the in-process context is transparent for the user (see [zipkin-context-cls](pakcages/zipkin-context-cls)).

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
