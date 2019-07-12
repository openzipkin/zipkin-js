# zipkin-instrumentation-gotjs

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-gotjs.svg)

This library will wrap the [Got client](https://github.com/sindresorhus/got).

## Usage

```javascript
const got = require('got');
const {Tracer} = require('zipkin');
const wrapGot = require('zipkin-instrumentation-got');

const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'youtube';
const zipkinGot = wrapGot(got, {tracer, remoteServiceName});

// Your application code here
zipkinGot('http://www.youtube.com/').then(res => res.body).then(data => ...);
```
