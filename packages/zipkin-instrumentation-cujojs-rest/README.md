# zipkin-instrumentation-cujojs-rest

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-cujojs-rest.svg)

This library will let you add interceptors to the [rest](https://www.npmjs.com/package/rest) client library.

## Usage

```javascript
const {Tracer} = require('zipkin');
const rest = require('rest');
const {restInterceptor} = require('zipkin-instrumentation-cujojs-rest');

const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'youtube';
const client = rest.wrap(restInterceptor, {tracer, remoteServiceName});

// Your application code here
client('http://www.youtube.com/').then(success => {
  console.log('got result from YouTube');
}, error => {
  console.error('Error', error);
});
```
