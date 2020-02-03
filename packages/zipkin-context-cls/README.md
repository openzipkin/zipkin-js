# zipkin-context-cls

![npm](https://img.shields.io/npm/dm/zipkin-context-cls.svg)

This module implements a context API on top of [CLS/continuation-local-storage](https://github.com/othiym23/node-continuation-local-storage).
The primary objective of CLS is to implement a *transparent* context API, that is, you don't need to pass around a `ctx`
variable everywhere in your application code.

## Usage

```javascript
const CLSContext = require('zipkin-context-cls');
const tracer = new Tracer({
  ctxImpl: new CLSContext('zipkin'),
  recorder, // typically HTTP or Kafka
  localServiceName: 'service-a' // name of this application
});
```

## A note on CLS context vs. explicit context

There are known issues and limitations with CLS, so some people might prefer to use `ExplicitContext` instead;
the drawback then is that you have to pass around a context object manually.

## A note on CLS context and Promises

By default, this package is not suitable if your code inside the context uses promises, however you can enable an experimental feature for async/await support by using [cls_hooked](https://github.com/jeff-lewis/cls-hooked) library which underneath uses [async_hooks](https://nodejs.org/api/async_hooks.html).

```javascript
const CLSContext = require('zipkin-context-cls');
const tracer = new Tracer({
  ctxImpl: new CLSContext('zipkin', true),
  recorder,
  localServiceName: 'service-a'
});
```

At the time of this writing, `async_hooks` [have some performance implications](https://github.com/DataDog/dd-trace-js/issues/695) whose effect may vary depending on the node version.

The underneath implementation for async_hooks may change, that is why we hide that with the opt-in parameter.

## A note on the workings of CLS context

The package will create a namespace called 'zipkin' by default, if it does not exist yet. In this namespace the code sets the context with the key 'zipkin'. This does not mean that the context is overwritten at every request. The namespace is tied to the call-chain. Data stored within that namespace is unique to that request and namespace. For reference see: [here](https://speakerdeck.com/fredkschott/conquering-asynchronous-context-with-cls?slide=27).

## Troubleshooting

If you are using the `Express` framework with `CLSContext`, the `body-parser` middleware may interfere and lose the context. To prevent that, make sure that the `body-parser` middleware is registered before `zipkin` in the middleware chain. If you are not explicitly registering `body-parser`, please do so by adding `app.use(bodyParser.json());` above the Zipkin middleware registration line.
