
# zipkin-transport-http

![npm](https://img.shields.io/npm/dm/zipkin-transport-http.svg)

This is a module that sends Zipkin trace data to a configurable HTTP endpoint.

## Usage

`npm install zipkin-transport-http --save`

```javascript
const {
  Tracer,
  BatchRecorder,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
const noop = require('noop-logger');

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: 'http://localhost:9411/api/v2/spans', // Required
    jsonEncoder: JSON_V2, // JSON encoder to use. Optional (defaults to JSON_V1)
    httpInterval: 1000, // How often to sync spans. Optional (defaults to 1000)
    headers: {'Authorization': 'secret'}, // Custom HTTP headers. Optional
    timeout: 1000, // Timeout for HTTP Post. Optional (defaults to 0)
    maxPayloadSize: 0, // Max payload size for zipkin span. Optional (defaults to 0)
    agent: new http.Agent({keepAlive: true}), // Agent used for network related options. Optional (defaults to null)
    log: noop, // Logger to use. Optional (defaults to console)
    fetchImplementation: require('node-fetch') // Pluggable fetch implementation (defaults to global fetch or fallsback to node fetch)
  })
});

const tracer = new Tracer({
  recorder,
  ctxImpl, // this would typically be a CLSContext or ExplicitContext
  localServiceName: 'service-a' // name of this application
});
```

## Options

### Required

- **endpoint** - HTTP endpoint which spans will be sent.

### Optional

- **agent** - HTTP(S) agent to use for any networking related options.
  - Takes an [http](https://nodejs.org/api/http.html#http_class_http_agent)/[https](https://nodejs.org/api/https.html) NodeJS Agent.
  - Defaults to null

```javascript
// Example using a self-signed CA, along with cert/key for mTLS.
new HttpLogger({
  endpoint: 'http://localhost:9411/api/v2/spans',
  agent: new http.Agent({
    ca: fs.readFileSync('pathToCaCert'),
    cert: fs.readFileSync('pathToCert'),
    key: fs.readFileSync('pathToPrivateKey')
  })
})
```

- **headers** - Any additional HTTP headers to be sent with span.
  - Will set `'Content-Type':  'application/json'` at a minimum
- **httpInterval** - How often to sync spans.
  - Defaults to 1000
- **jsonEncoder** - JSON encoder to use when sending spans.
  - Defaults to JSON_V1
- **maxPayloadSize** - Max payload size for zipkin span.
  - Will drop any spans exceeding this threshold.
  - Defaults to 0 (Disabled)
- **log** - Internal logger used within the transport.
  - Defaults to console
- **timeout** - Timeout for HTTP Post when sending spans.
  - Defaults to 0 (Disabled)
- **fetchImplementation** - The fetch API to be used for sending spans.
  - Defaults to default global fetch or fallsback to `node-fetch`.
  - A different fetch implementation can be plugged to fulfill different requirements, for example one can use [fetch-retry](https://github.com/jonbern/fetch-retry) to allow retries and exponential back-off:

    ```javascript
    const {HttpLogger} = require('zipkin-transport-http');
    const fetch = require('node-fetch');
    const fetchRetryBuilder = require('fetch-retry');

    const fetchRetryOptions = {
      // retry on any network error, or > 408 or 5xx status codes
      retryOn: (attempt, error, response) => error !== null
        || response == null
        || response.status >= 408,
      retryDelay: tryIndex => 1000 ** tryIndex // with an exponentially growing backoff
    };

    const fetchImplementation = fetchRetryBuilder(fetch, fetchRetryOptions);

    const httpLogger = new HttpLogger({
      endpoint: `http://localhost:9411/api/v1/spans`,
      httpInterval: 1,
      fetchImplementation
    });
    ```
