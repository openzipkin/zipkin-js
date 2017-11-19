# zipkin-instrumentation-fetch

This library will wrap the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
You need to provide your own `fetch` implementation; it could for example come from `window.fetch` (in the browser),
or [node-fetch](https://www.npmjs.com/package/node-fetch) on Node.js.

## Usage

```javascript
const {Tracer} = require('zipkin');
const wrapFetch = require('zipkin-instrumentation-fetch');

const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const remoteServiceName = 'youtube';
const zipkinFetch = wrapFetch(fetch, {tracer, remoteServiceName});

// Your application code here
zipkinFetch('http://www.youtube.com/').then(res => res.json()).then(data => ...);
```
