# zipkin-context-cls

This module implements a context API on top of [CLS/continuation-local-storage](https://github.com/othiym23/node-continuation-local-storage).
The primary objective of CLS is to implement a *transparent* context API, that is, you don't need to pass around a `ctx`
variable everywhere in your application code.

## Usage:

```javascript
const CLSContext = require('zipkin-context-cls');
const tracer = new Tracer({
  ctxImpl: new CLSContext('zipkin'),
  recorder, // typically Kafka or Scribe
  localServiceName: 'service-a' // name of this application
});
```

## A note on CLS context vs. explicit context

There are known issues and limitations with CLS, so some people might prefer to use `ExplicitContext` instead;
the drawback then is that you have to pass around a context object manually.

## A note on CLS context and Promises
This package is not suitable if your code inside the context uses promises. The context is then not properly propagated. There is work underway called [async_hooks](https://nodejs.org/api/async_hooks.html), but is at the time of this writing (node v10) in Experimental state.

## A note on the workings of CLS context
The package will create a namespace called 'zipkin' by default, if it does not exist yet. In this namespace the code sets the context with the key 'zipkin'. This does not mean that the context is overwritten at every request. The namespace is tied to the call-chain. Data stored within that namespace is unique to that request and namespace. For reference see: [here](https://speakerdeck.com/fredkschott/conquering-asynchronous-context-with-cls?slide=27).
