[![Build Status](https://travis-ci.org/openzipkin/zipkin-js.svg?branch=master)](https://travis-ci.org/openzipkin/zipkin-js)

WARNING: This library is still a work in progress. You may encounter a few bugs!

# Zipkin.js

This is a library for instrumenting Node.js applications. It uses a lot of
new JavaScript features and syntax, so Node.js version 6 or newer is required.


## Installation:

`npm install zipkin --save`


## Instrumentations

Various Node.js libraries have been instrumented with Zipkin support.
Every instrumentation has an npm package called zipkin-instrumentation-*.

At the time of writing, zipkin-js instruments these libraries:

- [cujojs/rest](packages/zipkin-instrumentation-cujojs-rest) (zipkin-instrumentation-cujojs-rest)
- [express](packages/zipkin-instrumentation-express) (zipkin-instrumentation-express)
- [fetch](packages/zipkin-instrumentation-fetch) (zipkin-instrumentation-fetch)
- [hapi](packages/zipkin-instrumentation-hapi) (zipkin-instrumentation-hapi)
- [memcached](packages/zipkin-instrumentation-memcached) (zipkin-instrumentation-memcached)
- [redis](packages/zipkin-instrumentation-redis) (zipkin-instrumentation-redis)
- [restify](packages/zipkin-instrumentation-restify) (zipkin-instrumentation-restify)

Every module has a README.md file that describes how to use it.

## Transports

You can choose between multiple transports; they are npm packages called zipkin-transport-*.

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
Instead of running lerna directly, the commands are wrapped with npm; `npm run lerna-bootstrap`
and `npm run lerna-publish`.

To setup the development environment, run:

```
npm install
npm run lerna-bootstrap
```

Running tests: `npm test`

Note that the memcached integration test requires you to have a local memcached instance running.
The Kafka integration test will start an embedded Kafka server for the test, which requires you to have
Java installed on your machine.

Running code style linting: `npm run lint`

## Publishing

If you are a user waiting for a merged feature to get released, nag us on the related pull request or [gitter](https://gitter.im/openzipkin/zipkin).

The actual publish process is easy: Log in to npm with the "OpenZipkin" user. Then, run `npm run lerna-publish`.
