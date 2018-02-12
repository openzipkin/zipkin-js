/* eslint-disable no-console */
const globalFetch =
  (typeof window !== 'undefined' && window.fetch) ||
  (typeof global !== 'undefined' && global.fetch);

// eslint-disable-next-line global-require
const fetch = globalFetch || require.call(null, 'node-fetch');

const {
  jsonEncoder: {JSON_V1}
} = require('zipkin');

const EventEmitter = require('events').EventEmitter;

class HttpLogger extends EventEmitter {
  constructor({endpoint, headers = {}, httpInterval = 1000, jsonEncoder = JSON_V1, timeout = 0}) {
    super(); // must be before any reference to *this*
    this.endpoint = endpoint;
    this.queue = [];
    this.jsonEncoder = jsonEncoder;

    this.errorListenerSet = false;

    this.headers = Object.assign({
      'Content-Type': 'application/json'
    }, headers);

    // req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies)
    // only supported by node-fetch; silently ignored by browser fetch clients
    // @see https://github.com/bitinn/node-fetch#fetch-options
    this.timeout = timeout;

    const timer = setInterval(() => {
      this.processQueue();
    }, httpInterval);
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  on(...args) {
    const eventName = args[0];
    // if the instance has an error handler set then we don't need to
    // console.log errors anymore
    if (eventName.toLowerCase() === 'error') this.errorListenerSet = true;
    super.on.apply(this, args);
  }

  logSpan(span) {
    this.queue.push(this.jsonEncoder.encode(span));
  }

  processQueue() {
    const self = this;
    if (self.queue.length > 0) {
      const postBody = `[${self.queue.join(',')}]`;
      fetch(self.endpoint, {
        method: 'POST',
        body: postBody,
        headers: self.headers,
        timeout: self.timeout,
      }).then((response) => {
        if (response.status !== 202) {
          const err = 'Unexpected response while sending Zipkin data, status:' +
            `${response.status}, body: ${postBody}`;

          if (self.errorListenerSet) this.emit('error', new Error(err));
          else console.error(err);
        }
      }).catch((error) => {
        const err = `Error sending Zipkin data ${error}`;
        if (self.errorListenerSet) this.emit('error', new Error(err));
        else console.error(err);
      });
      self.queue.length = 0;
    }
  }
}

module.exports = HttpLogger;
