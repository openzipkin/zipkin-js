# Zipkin.js

[![Build Status](https://travis-ci.org/openzipkin/zipkin-js.svg?branch=master)](https://travis-ci.org/openzipkin/zipkin-js)
[![npm version](https://badge.fury.io/js/zipkin.svg)](https://badge.fury.io/js/zipkin)
[![Gitter chat](https://badges.gitter.im/openzipkin/zipkin.svg)](https://gitter.im/openzipkin/zipkin?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This is a library for instrumenting Node.js applications. It uses a lot of
new JavaScript features and syntax, so Node.js version 6 or newer is required.

If you'd like to try this out right away, try our [example app](https://github.com/openzipkin/zipkin-js-example) which shows
how tracing services looks.


## Installation:

`npm install zipkin --save`

## Basic Setup:

```javascript
const {
  Tracer,
  BatchRecorder,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const {HttpLogger} = require('zipkin-transport-http');

// Setup the tracer to use http and implicit trace context
const tracer = new Tracer({
  ctxImpl: new CLSContext('zipkin'),
  recorder: new BatchRecorder({
    logger: new HttpLogger({
      endpoint: 'http://localhost:9411/api/v2/spans',
      jsonEncoder: JSON_V2
    })
  }),
  localServiceName: 'service-a' // name of this application
});

// now use tracer to construct instrumentation! For example, fetch
const wrapFetch = require('zipkin-instrumentation-fetch');

const remoteServiceName = 'youtube';
const zipkinFetch = wrapFetch(fetch, {tracer, remoteServiceName});
```

## Instrumentations

Various Node.js libraries have been instrumented with Zipkin support.
Every instrumentation has an npm package called `zipkin-instrumentation-*`.

At the time of writing, zipkin-js instruments these libraries:

- [cujojs/rest](packages/zipkin-instrumentation-cujojs-rest) (zipkin-instrumentation-cujojs-rest)
- [express](packages/zipkin-instrumentation-express) (zipkin-instrumentation-express)
- [fetch](packages/zipkin-instrumentation-fetch) (zipkin-instrumentation-fetch)
- [hapi](packages/zipkin-instrumentation-hapi) (zipkin-instrumentation-hapi)
- [memcached](packages/zipkin-instrumentation-memcached) (zipkin-instrumentation-memcached)
- [redis](packages/zipkin-instrumentation-redis) (zipkin-instrumentation-redis)
- [restify](packages/zipkin-instrumentation-restify) (zipkin-instrumentation-restify)
- [postgres](packages/zipkin-instrumentation-postgres) (zipkin-instrumentation-postgres)
- [request](packages/zipkin-instrumentation-request) (zipkin-instrumentation-request)
- [connect](packages/zipkin-instrumentation-connect) (zipkin-instrumentation-connect)
- [superagent](packages/zipkin-instrumentation-superagent) (zipkin-instrumentation-superagent)
- [grpc-client](packages/zipkin-instrumentation-grpc-client) (zipkin-instrumentation-grpc-client)

Every module has a README.md file that describes how to use it.

## Transports

You can choose between multiple transports; they are npm packages called `zipkin-transport-*`.

Currently, the following transports are available:

- [http](packages/zipkin-transport-http)
- [kafka](packages/zipkin-transport-kafka)
- [scribe](packages/zipkin-transport-scribe)

Every package has its own README.md which describes how to use it.

## Clock precision

Zipkin timestamps are microsecond, not millisecond granularity. When running in node.js,
[process.hrtime](https://nodejs.org/api/process.html#process_process_hrtime_time) is used to
achieve this.

In browsers, microsecond precision requires installing a shim like [browser-process-hrtime](https://github.com/kumavis/browser-process-hrtime):
```javascript
// use higher-precision time than milliseconds
process.hrtime = require('browser-process-hrtime');
```

## Developing

The code base is a monorepo. We use [Lerna](https://lernajs.io/) for managing inter-module
dependencies, which makes it easier to develop coordinated changes between the modules.
Instead of running lerna directly, the commands are wrapped with npm; `npm run lerna-publish`.

To setup the development environment, run:

```
yarn
```

Running tests: `yarn test`

Note that the memcached, redis and postgres integration tests requires you to have local instances running.
The Kafka integration test will start an embedded Kafka server for the test, which requires you to have
Java installed on your machine.

Running code style linting: `yarn lint`

AppVeyor is currently broken and ignored. PR welcome from those with Windows boxes.

## Publishing

If you are a user waiting for a merged feature to get released, nag us on the related pull request or [gitter](https://gitter.im/openzipkin/zipkin).

The actual publish process is easy: Log in to npm with the "OpenZipkin" user. Then, run `npm run lerna-publish`.
