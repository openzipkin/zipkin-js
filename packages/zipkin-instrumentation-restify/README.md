# zipkin-instrumentation-restify

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-restify.svg)

A Restify plugin that adds Zipkin tracing to the application.

## Usage

```javascript
const restify = require('restify');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-restify').restifyMiddleware;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const app = restify.createServer();

// Add the Zipkin middleware
app.use(zipkinMiddleware({tracer}));
```
