# zipkin-instrumentation-connect

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-connect.svg)

A Connect middleware and instrumentation that adds Zipkin tracing to the application.
Compatible with any server which uses the connect api (Express and Restify).

## Usage

### Connect
```javascript
const connect = require('connect');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-connect');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const app = connect();

// Add the Zipkin middleware
app.use(zipkinMiddleware({tracer}));
```

### Express
```javascript
const express = require('express');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-connect');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const app = express();

// Add the Zipkin middleware
app.use(zipkinMiddleware({tracer}));
```

## Restify
```javascript
const restify = require('restify');
const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const zipkinMiddleware = require('zipkin-instrumentation-connect');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const app = restify.createServer();

// Add the Zipkin middleware
app.use(zipkinMiddleware({tracer}));
```
