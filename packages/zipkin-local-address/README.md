# Zipkin-local-address
Adds a default host functionality, works only for node and defaults back to `127.0.0.1` in the browser.

## Usage:

`npm install zipkin-local-address --save`

```javascript
const zipkin = require('zipkin')
const tracer = new zipkin.Tracer({
  localAddr: require('zipkin-local-address'),
})
```
