# zipkin-instrumentation-express

Express middleware and instrumentation that adds Zipkin tracing to the application.

## Express Middleware

```javascript
const express = require('express');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const app = express();

// Add the Zipkin middleware
app.use(zipkinMiddleware({tracer}));
```

## Express HTTP Proxy

This library will wrap [express-http-proxy](https://www.npmjs.com/package/express-http-proxy) to add headers and record traces.

```javascript
const {ConsoleRecorder, Tracer, ExplicitContext} = require('zipkin');
const {wrapExpressHttpProxy} = require('zipkin-instrumentation-express');
const proxy = require('express-http-proxy');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({ctxImpl, recorder});
const serviceName = 'weather-app';
const remoteServiceName = 'weather-api';

const zipkinProxy = wrapExpressHttpProxy(proxy, {tracer, serviceName, remoteServiceName});

app.use('/api/weather', zipkinProxy('http://api.weather.com', {
  decorateRequest: (proxyReq, originalReq) => proxyReq.method = 'POST' // You can use express-http-proxy options as usual
}));
```
This can also be combined with Zipkin Express Middleware. Note the use of `zipkin-context-cls`.
```javascript
const {ConsoleRecorder, Tracer} = require('zipkin');
const {expressMiddleware, wrapExpressHttpProxy} = require('zipkin-instrumentation-express')
const CLSContext = require('zipkin-context-cls');
const proxy = require('express-http-proxy');

const ctxImpl = new CLSContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({ctxImpl, recorder});
const serviceName = 'weather-app';
const remoteServiceName = 'weather-api';

const zipkinProxy = wrapExpressHttpProxy(proxy, {tracer, serviceName, remoteServiceName});

app.use('/api/weather', expressMiddleware({tracer, serviceName}), zipkinProxy('http://api.weather.com'));
```