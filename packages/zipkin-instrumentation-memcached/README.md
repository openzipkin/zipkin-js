# zipkin-instrumentation-memcached

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-memcached.svg)

This library will wrap the [memcached client](https://www.npmjs.com/package/memcached).

## Usage

```javascript
const {Tracer} = require('zipkin');
const Memcached = require('memcached');
const zipkinClient = require('zipkin-instrumentation-memcached');

const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

const connectionString = ''localhost:11211'';
const options = {timeout: 1000};
const memcached = new (zipkinClient(tracer, Memcached))(connectionString, options);

// Your application code here
memcached.get('foo', (err, data) => {
  console.log('got', data.foo);
});
```
