# zipkin-instrumentation-hapi

A hapi middleware that adds Zipkin tracing to the application.

## Usage

```javascript
const Hapi = require('hapi');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-hapi').hapiMiddleware;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const server = new Hapi.Server();

// Add the Zipkin middleware
server.register({
  register: zipkinMiddleware,
  options: {
    tracer,
    serviceName: 'service-a' // name of this application
  }
});
```
