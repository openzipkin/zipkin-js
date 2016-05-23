[![Build Status](https://travis-ci.org/openzipkin/zipkin-js.svg?branch=master)](https://travis-ci.org/openzipkin/zipkin-js)

# Zipkin.js

This is a library for instrumenting Node.js applications. It uses a lot of
new JavaScript features and syntax, so Node.js version 6 or newer is required.


## Installation:

`npm install zipkin --save`

## Usage:

```javascript
const {tracer, consoleTracer} = require('zipkin');

tracer.pushTracer(consoleTracer);
```

## Instrumentations

Various Node.js libraries have been instrumented with Zipkin support.
In this project:

- express
- cujojs/rest

## Transports

You can choose between multiple transports; for now,
scribe and kafka transports are implemented. They can
be used like this:

Scribe:

```javascript
const ScribeTracer = require('zipkin-transport-scribe');
tracer.pushTracer(new ScribeTracer({
  host: 'localhost',
  port: 9410
});
```

Kafka

```javascript
const KafkaTracer = require('zipkin-transport-kafka');
tracer.pushTracer(new KafkaTracer({
  clientOpts: {connectionString: 'localhost:2181'}
});
```

## Developing

The code base is a monorepo. We use [Lerna](https://github.com/kittens/lerna) for managing inter-module
dependencies, which makes it easier to develop coordinated changes.

To setup, run:

npm install
npm run lerna-bootstrap

Running tests: npm test

Running code style linting: npm run lint

## Publishing

npm run lerna-publish

