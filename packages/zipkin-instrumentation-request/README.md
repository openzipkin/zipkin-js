# zipkin-instrumentation-request

Adds Zipkin tracing to the [request](https://www.npmjs.com/package/request) library.

## Usage

```javascript
const express = require('express');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const wrapRequest = require('zipkin-instrumentation-request');
const request = require('request');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const serviceName = 'weather-app';
const remoteServiceName = 'weather-api';
const zipkinRequest = wrapRequest(request, {tracer, serviceName, remoteServiceName});

zipkinRequest({
    url: 'http://api.weather.com',
    method: 'GET',
  }, function(error, response, body) {
    console.log('error:', error);
    console.log('statusCode:', response && response.statusCode);
    console.log('body:', body);
  });
```
