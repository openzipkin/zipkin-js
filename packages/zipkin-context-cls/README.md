# zipkin-context-cls

This module implements a context API on top of [CLS/continuation-local-storage](https://github.com/othiym23/node-continuation-local-storage).
The primary objective of CLS is to implement a *transparent* context API, that is, you don't need to pass around a `ctx`
variable everywhere in your application code.

## Usage:

```javascript
const CLSContext = require('zipkin-context-cls');
const tracer = new Tracer({
  context: new CLSContext('zipkin')
});
```

## A not on CLS context vs. explicit context

There are known issues and limitations with CLS, so some people might prefer to use zipkin-context-explicit instead;
the drawback then is that you have to pass around a context object manually.
