# zipkin-instrumentation-express

An express middleware that adds Zipkin tracing to the application.

## Usage

```javascript
const express = require('express');
const {trace} = require('zipkin-core');
const zipkinMiddleware = require('zipkin-instrumentation-express');

trace.pushTracer(ConsoleTracer);
const app = express();
app.use(zipkinMiddleware({
  serviceName: 'service-a', // name of this application
  port: 8080 // port this application is listening on
}));
```
