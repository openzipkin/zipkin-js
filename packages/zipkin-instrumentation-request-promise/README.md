# zipkin-instrumentation-request-promise

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-request-promise.svg)

Adds Zipkin tracing to the [request](https://www.npmjs.com/package/request) and [request-promise](https://www.npmjs.com/package/request-promise) libraries.

## Usage
The library provides two ways to instrument your request. You have the `wrapRequest` function which provides an interface similar to [zipkin-instrumentation-request](https://github.com/openzipkin/zipkin-js/tree/master/packages/zipkin-instrumentation-request) and `Request` class which follow the OOP patterns. Keep in mind `wrapRequest` is just a wrapper around `Request` class, so there is no difference between the two.

### Using the wrapRequest function
```javascript
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const {wrapRequest} = require('zipkin-instrumentation-request-promise');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'weather-api';
const request = wrapRequest(tracer, remoteServiceName);

request({
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

### Using the Request class
```javascript
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const ZipkinRequest = require('zipkin-instrumentation-request-promise').default;

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'weather-api';
const request = new ZipkinRequest(tracer, remoteServiceName);

request.get('http://api.weather.com')
  .then(function(body, response) {
    console.log('statusCode:', response && response.statusCode);
    console.log('body:', body);
  })
  .catch(function(err){
    console.log('error:', error);
  });
```