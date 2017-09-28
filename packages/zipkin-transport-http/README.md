# Zipkin-transport-http
This is a module that sends Zipkin trace data to a configurable HTTP endpoint.

## Usage:

`npm install zipkin-transport-http --save`

```javascript
const {Tracer, BatchRecorder} = require('zipkin');
// you may overwrite fetch in node, otherwise it defaults to window.fetch
const fetch = require('node-fetch'); 
const {HttpLogger} = require('zipkin-transport-http');

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: 'http://localhost:9411/api/v1/spans',
    fetch
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl // this would typically be a CLSContext or ExplicitContext
});
```
