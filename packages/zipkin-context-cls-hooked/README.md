# zipkin-context-cls-hooked

This module implements a context API on top of [Continuation-Local Storage ( Hooked )](https://github.com/jeff-lewis/cls-hooked).

The primary objective of CLS is to implement a *transparent* context API, that is, you don't need to pass around a `ctx`
variable everywhere in your application code.

CLS-hooked is a fork of CLS to support **async/await** notation in Node v8 and higher.

If using Node v7 or lower please make sure to understand the limitations of [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked)
and consider using [zipkin-context-cls](https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-context-cls) instead.

## Usage:

```javascript
const CLSHookedContext = require('zipkin-context-cls-hooked');
const tracer = new Tracer({
  ctxImpl: new CLSHookedContext('zipkin'),
  recorder // typically Kafka or Scribe
});
```

## A note on CLS context vs. explicit context

There are known issues and limitations with CLS, so some people might prefer to use `ExplicitContext` instead;
the drawback then is that you have to pass around a context object manually.
