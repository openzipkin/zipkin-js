# zipkin-instrumentation-request-promise

Adds Zipkin tracing to the [request](https://www.npmjs.com/package/request) and [request-promise](https://www.npmjs.com/package/request-promise) libraries.

## Usage

```javascript
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const ZipkinRequest = require('zipkin-instrumentation-request-promise').default;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'weather-api';
const request = new ZipkinRequest(tracer);

request.send({
    url: 'http://api.weather.com',
    method: 'GET',
  })
  .then(function(body, response) {
    console.log('statusCode:', response && response.statusCode);
    console.log('body:', body);
  })
  .catch(function(err){
    console.log('error:', error);
  });
```