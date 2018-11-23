/* eslint-disable no-console */
const globalFetch =
  (typeof window !== 'undefined' && window.fetch) ||
  (typeof global !== 'undefined' && global.fetch);

// eslint-disable-next-line global-require
const fetch = globalFetch || require('node-fetch');

const {
  jsonEncoder: {JSON_V1}
} = require('zipkin');

const EventEmitter = require('events').EventEmitter;

class HttpLogger extends EventEmitter {
  constructor({
    endpoint,
    headers = {},
    httpInterval = 1000,
    jsonEncoder = JSON_V1,
    timeout = 0,
    maxPayloadSize = 0,
    /* eslint-disable no-console */
    log = console
  }) {
    super(); // must be before any reference to *this*
    this.log = log;
    this.endpoint = endpoint;
    this.maxPayloadSize = maxPayloadSize;
    this.queue = [];
    this.queueBytes = 0;
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

  _getPayloadSize(nextSpan) {
    // Our payload is in format '[s1,s2,s3]', so we need to add 2 brackets and
    // one comma separator for each payload, including the next span if defined
    return nextSpan
      ? this.queueBytes + 2 + this.queue.length + nextSpan.length
      : this.queueBytes + 2 + Math.min(this.queue.length - 1, 0);
  }

  on(...args) {
    const eventName = args[0];
    // if the instance has an error handler set then we don't need to
    // skips error logging
    if (eventName.toLowerCase() === 'error') this.errorListenerSet = true;
    super.on.apply(this, args);
  }

  logSpan(span) {
    const encodedSpan = this.jsonEncoder.encode(span);
    if (this.maxPayloadSize && this._getPayloadSize(encodedSpan) > this.maxPayloadSize) {
      this.processQueue();
      if (this._getPayloadSize(encodedSpan) > this.maxPayloadSize) {
        // Payload size is too large even with an empty queue, can only drop
        const err = 'Zipkin span got dropped, reason: payload too large';
        if (this.errorListenerSet) this.emit('error', new Error(err));
        else this.log.error(err);
        return;
      }
    }
    this.queue.push(encodedSpan);
    this.queueBytes += encodedSpan.length;
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
        if (response.status !== 202 && response.status !== 200) {
          const err = 'Unexpected response while sending Zipkin data, status:' +
            `${response.status}, body: ${postBody}`;

          if (self.errorListenerSet) this.emit('error', new Error(err));
          else this.log.error(err);
        } else {
          this.emit('success', response);
        }
      }).catch((error) => {
        const err = `Error sending Zipkin data ${error}`;
        if (self.errorListenerSet) this.emit('error', new Error(err));
        else this.log.error(err);
      });
      self.queue.length = 0;
      self.queueBytes = 0;
    }
  }
}

module.exports = HttpLogger;
