# zipkin-instrumentation-koa

Zipkin middleware for Koa that traces incoming HTTP requests.

## Installation
`npm install zipkin-instrumentation-koa`

## Usage
```js
const Koa = require('koa');
const {Tracer, ConsoleRecorder, ExplicitContext} = require('zipkin');
const {zipkinMiddleware} = require('zipkin-instrumentation-koa');

const recorder = new ConsoleRecorder();
const ctxImpl = new ExplicitContext();
const tracer = new Tracer({recorder, ctxImpl});
const app = new Koa();

app.use(zipkinMiddleware({tracer, serviceName: 'zipkin-koa-demo', port: 3000}));
```
