# zipkin-instrumentation-redis

This library will wrap the [redis client](https://www.npmjs.com/package/redis).

## Usage

```javascript
const {Tracer} = require('zipkin');
const Redis = require('redis');
const zipkinClient = require('zipkin-instrumentation-redis');
const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here
const redisConnectionOptions = {
  host: 'localhost',
  port: '6379'
};
const redisClient = Redis.createClient(redisConnectionOptions);
const redis = zipkinClient(tracer, redisClient);

// Your application code here
redis.get('foo', (err, data) => {
  console.log('got', data.foo);
});
```
