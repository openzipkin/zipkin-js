# zipkin-instrumentation-fetch

This library will wrap the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
You need to provide your own `fetch` implementation; it could for example come from `window.fetch` (in the browser),
or [node-fetch](https://www.npmjs.com/package/node-fetch) on Node.js.

## Usage

```javascript
const {Tracer} = require('zipkin');
const wrapFetch = require('zipkin-instrumentation-fetch');

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const nameOfRemoteService = 'youtube';
const zipkinFetch = wrapFetch(fetch, {tracer, remoteServiceName: nameOfRemoteService});

// Your application code here
zipkinFetch('http://www.youtube.com/').then(res => res.json()).then(data => ...);
```
