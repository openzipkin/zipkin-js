# zipkin-instrumentation-request

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-request.svg)

Adds Zipkin tracing to the [request](https://www.npmjs.com/package/request) library.

## Usage

```javascript
const express = require('express');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const wrapRequest = require('zipkin-instrumentation-request');
const request = require('request');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'weather-api';
const zipkinRequest = wrapRequest(request, {tracer, remoteServiceName});

zipkinRequest({
    url: 'http://api.weather.com',
    method: 'GET',
  }, function(error, response, body) {
    console.log('error:', error);
    console.log('statusCode:', response && response.statusCode);
    console.log('body:', body);
  });
```
