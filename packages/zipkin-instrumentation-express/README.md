# zipkin-instrumentation-express

An express middleware that adds Zipkin tracing to the application.

## Usage

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
