# zipkin-context-cls

This module implements a context API on top of [CLS/continuation-local-storage](https://github.com/othiym23/node-continuation-local-storage).
The primary objective of CLS is to implement a *transparent* context API, that is, you don't need to pass around a `ctx`
variable everywhere in your application code.

This library does not preserve context when **async/await** is used. If you need that functionality please
use [zipkin-context-cls-hooked](https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-context-cls-hooked) instead.

## Usage:

```javascript
const CLSContext = require('zipkin-context-cls');
const tracer = new Tracer({
  ctxImpl: new CLSContext('zipkin'),
  recorder // typically Kafka or Scribe
});
```

## A note on CLS context vs. explicit context

There are known issues and limitations with CLS, so some people might prefer to use `ExplicitContext` instead;
the drawback then is that you have to pass around a context object manually.
