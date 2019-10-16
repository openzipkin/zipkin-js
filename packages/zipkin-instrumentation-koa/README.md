# zipkin-instrumentation-koa

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-koa.svg)

Zipkin middleware for Koa 2.7+ that traces incoming HTTP requests.

## Installation
`npm install zipkin-instrumentation-koa`

## Usage
```js
const Koa = require('koa');
const {Tracer, ConsoleRecorder, ExplicitContext} = require('zipkin');
const {koaMiddleware} = require('zipkin-instrumentation-koa');

const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const tracer = new Tracer({recorder, ctxImpl, localServiceName: 'zipkin-koa-demo'});

const app = new Koa();

app.use(koaMiddleware({tracer}));
```
