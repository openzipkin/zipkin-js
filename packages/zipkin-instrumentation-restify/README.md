# zipkin-instrumentation-restify

A Restify plugin that adds Zipkin tracing to the application.

## Usage

```javascript
const restify = require('restify');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-restify').restifyMiddleware;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const app = restify.createServer();

// Add the Zipkin middleware
app.use(zipkinMiddleware({
  tracer,
  serviceName: 'service-a' // name of this application
}));
```
