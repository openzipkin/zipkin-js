# zipkin-instrumentation-cujojs-rest

This library will let you add interceptors to the [rest](https://www.npmjs.com/package/rest) client library.

## Usage

```javascript
const {Tracer} = require('zipkin');
const rest = require('rest');
const {restInterceptor} = require('zipkin-instrumentation-cujojs-rest');

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const nameOfRemoteService = 'youtube';
const client = rest.wrap(restInterceptor, {tracer, remoteServiceName: nameOfRemoteService});

// Your application code here
client('http://www.youtube.com/').then(success => {
  console.log('got result from YouTube');
}, error => {
  console.error('Error', error);
});
```
