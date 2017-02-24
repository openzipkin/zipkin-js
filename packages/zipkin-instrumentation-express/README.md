# zipkin-instrumentation-express

Express middleware and instrumentation that adds Zipkin tracing to the application.

## Express Middleware

```javascript
const express = require('express');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const app = express();

// Add the Zipkin middleware
app.use(zipkinMiddleware({
  tracer,
  serviceName: 'service-a' // name of this application
}));
```

## Express Http Proxy

This library will let you add interceptors to the [express-http-proxy](https://www.npmjs.com/package/express-http-proxy) library.

```javascript
const proxy = require('express-http-proxy');
const {ConsoleRecorder, Tracer, ExplicitContext} = require('zipkin');
const ProxyInstrumentation = require('zipkin-instrumentation-express').ExpressHttpProxyInstrumentation;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({ctxImpl, recorder});
const nameOfApp = 'weather-app';
const nameOfRemoteService = 'weather-api';
const proxyInstrumentation = new ProxyInstrumentation(tracer, nameOfApp, nameOfRemoteService);

app.use('/api/weather',
  proxy('http://api.weather.com', {
    decorateRequest: (proxyReq, originalReq) => proxyInstrumentation.decorateAndRecordRequest(proxyReq, originalReq),
    intercept: function(rsp, data, originalReq, res, callback) {
      proxyInstrumentation.recordResponse(rsp, originalReq);
      callback(null, data);
    }
}));

```
This can also be combined with Zipkin Express Middleware.
```javascript
const proxy = require('express-http-proxy');
const {ConsoleRecorder, Tracer} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
const ProxyInstrumentation = require('zipkin-instrumentation-express').ExpressHttpProxyInstrumentation;
const CLSContext = require('zipkin-context-cls');

const ctxImpl = new CLSContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({ctxImpl, recorder});
const nameOfApp = 'weather-app';
const nameOfRemoteService = 'weather-api';
const proxyInstrumentation = new ProxyInstrumentation(tracer, nameOfApp, nameOfRemoteService);

app.use('/api/weather',
  zipkinMiddleware({tracer, nameOfApp}),
  proxy('http://api.weather.com', {
    decorateRequest: (proxyReq, originalReq) => proxyInstrumentation.decorateAndRecordRequest(proxyReq, originalReq),
    intercept: function(rsp, data, originalReq, res, callback) {
      proxyInstrumentation.recordResponse(rsp, originalReq);
      callback(null, data);
    }
}));
```