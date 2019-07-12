# zipkin-instrumentation-hapi

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-hapi.svg)

A hapi middleware that adds Zipkin tracing to the application.

## Usage

```javascript
const Hapi = require('hapi');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-hapi').hapiMiddleware;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();

const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const server = new Hapi.Server();

// Add the Zipkin middleware
server.register({
  plugin: zipkinMiddleware,
  options: {tracer}
});
```
