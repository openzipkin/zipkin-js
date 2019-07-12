# zipkin-instrumentation-superagent

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-superagent.svg)

Adds Zipkin tracing to the [SuperAgent](https://www.npmjs.com/package/superagent) library.

## Usage

The library is a SuperAgent plugin and should be used as:

```javascript
const request = require('superagent');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinPlugin = require('zipkin-instrumentation-superagent');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'weather-api';
 
request
  .get('http://api.weather.com')
  .use(zipkinPlugin({tracer, remoteServiceName}))
  .end((err, res) => {
    // Do something
  });
```