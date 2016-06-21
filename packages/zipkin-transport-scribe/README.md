# Zipkin-transport-scribe

This is a module that sends Zipkin trace data from zipkin-js to Scribe or Fluentd.

## Usage:

`npm install zipkin-transport-scribe --save`

```javascript
const {Tracer, BatchRecorder} = require('zipkin');
const {ScribeLogger} = require('zipkin-transport-scribe');

const scribeRecorder = new BatchRecorder({
  logger: new ScribeLogger({
    scribeHost: '127.0.0.1',
    scribePort: port,
    scribeInterval: 1
  })
});

const tracer = new Tracer({
  scribeRecorder,
  ctxImpl // this would typically be a CLSContext or ExplicitContext
});
```
