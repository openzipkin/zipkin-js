# zipkin-instrumentation-koa

Zipkin middleware for Koa 2.7+ that traces incoming HTTP requests.

## Installation
`npm install zipkin-instrumentation-koa`

## Usage
```js
const Koa = require('koa');
const {Tracer, ConsoleRecorder, ExplicitContext} = require('zipkin');
const {zipkinMiddleware} = require('zipkin-instrumentation-koa');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({recorder, ctxImpl, serviceName: 'zipkin-koa-demo'});

const app = new Koa();

app.use(zipkinMiddleware({tracer}));
```
