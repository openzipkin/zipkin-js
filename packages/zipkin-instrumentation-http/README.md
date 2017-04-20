# zipkin-instrumentation-http

Adds Zipkin tracing to the [http](https://nodejs.org/api/http.html) library.

## Usage

```javascript
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const wrapHttp = require('zipkin-instrumentation-http');
const http = require('http');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const serviceName = 'weather-app';
const remoteServiceName = 'weather-api';
const zipkinHttp = wrapHttp(http, {tracer, serviceName, remoteServiceName});

zipkinHttp.request({
  host: 'api.weather.com',
  method: 'GET',
}, function(response) {
  response.on('data', (data) => {
    console.log(data)
  })
  response.on('error', (error) => {
    console.log(error)
  })
  response.on('end', () => {
    console.log('finished')
  })  
});

req.write("");
req.end();

zipkinHttp.get(
  'http://api.weather.com',             
  function(response) {
    response.on('data', (data) => {
        console.log(data)
    })
    response.on('error', (error) => {
      console.log(error)
    })
    response.on('end', () => {
      console.log('finished')
    })    
  });
```
