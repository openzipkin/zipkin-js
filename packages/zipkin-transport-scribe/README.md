# Zipkin-transport-scribe

![npm](https://img.shields.io/npm/dm/zipkin-transport-scribe.svg)

This is a module that sends Zipkin trace data from zipkin-js to Scribe or Fluentd.

## Usage

`npm install zipkin-transport-scribe --save`

```javascript
const {Tracer, BatchRecorder} = require('zipkin');
const {ScribeLogger} = require('zipkin-transport-scribe');
const noop = require('noop-logger');

const scribeRecorder = new BatchRecorder({
  logger: new ScribeLogger({
    scribeHost: '127.0.0.1',
    scribePort: port,
    scribeInterval: 1,
    log: noop // optional (defaults to console)
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl, // this would typically be a CLSContext or ExplicitContext
  localServiceName: 'service-a' // name of this application
});
```
