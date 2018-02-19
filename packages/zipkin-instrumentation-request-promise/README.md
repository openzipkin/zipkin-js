# zipkin-instrumentation-request-promise

Adds Zipkin tracing to the [request-promise](https://www.npmjs.com/package/request-promise) library.

## Usage

```
javascript
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const ZipkinRequest = require('zipkin-instrumentation-request-promise');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'weather-api';
const request = new ZipkinRequest(tracer, localServiceName, remoteServiceName);

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