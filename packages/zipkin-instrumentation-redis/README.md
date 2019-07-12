# zipkin-instrumentation-redis

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-redis.svg)

This library will wrap the [redis client](https://www.npmjs.com/package/redis).

## Usage

```javascript
const {Tracer} = require('zipkin');
const Redis = require('redis');
const zipkinClient = require('zipkin-instrumentation-redis');
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});
const redisConnectionOptions = {
  host: 'localhost',
  port: '6379'
};
const redis = zipkinClient(tracer, Redis, redisConnectionOptions);

// Your application code here
redis.get('foo', (err, data) => {
  console.log('got', data.foo);
});
```
