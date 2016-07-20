# Zipkin-transport-http
This is a module that sends Zipkin trace data to a configurable HTTP endpoint.

## Usage:

`npm install zipkin-transport-http --save`

```javascript
const {Tracer, BatchRecorder} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: 'http://localhost:9411/api/v1/spans'
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl // this would typically be a CLSContext or ExplicitContext
});
```
