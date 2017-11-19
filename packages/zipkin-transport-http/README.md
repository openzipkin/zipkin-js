# Zipkin-transport-http
This is a module that sends Zipkin trace data to a configurable HTTP endpoint.

## Usage:

`npm install zipkin-transport-http --save`

```javascript
const {
  Tracer,
  BatchRecorder,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: 'http://localhost:9411/api/v2/spans',
    jsonEncoder: JSON_V2, // optional, defaults to JSON_V1
    httpInterval: 1000, // how often to sync spans. optional, defaults to 1000
    headers: {'Authorization': 'secret'} // optional custom HTTP headers
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl, // this would typically be a CLSContext or ExplicitContext
  localServiceName: 'service-a' // name of this application
});
```

