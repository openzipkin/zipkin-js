# zipkin

This is the core npm package for Zipkin. It contains the public API which is used by the various
plugins (instrumentations and transports).

## Usage

```javascript
const zipkin = require('zipkin');

// In Node.js, the recommended context API to use is zipkin-context-cls.
const CLSContext = require('zipkin-context-cls');
const ctxImpl = new CLSContext(); // if you want to use CLS
const xtxImpl = new zipkin.ExplicitContext(); // Alternative; if you want to pass around the context manually

const tracer = new zipkin.Tracer({
  ctxImpl,
  recorder: new zipkin.ConsoleRecorder() // For easy debugging. You probably want to use an actual implementation, like Kafka or Scribe.
  sampler: new Zipkin.CountingSampler(0.01) // sample rate 0.01 will sample 1 % of all incoming requests
});
```
