/* eslint-disable no-console */
const globalFetch =
  (typeof window !== 'undefined' && window.fetch) ||
  (typeof global !== 'undefined' && global.fetch);

// eslint-disable-next-line global-require
const fetch = globalFetch || require.call(null, 'node-fetch');

const {
  jsonEncoder: {JSON_V1}
} = require('zipkin');

class HttpLogger {
  constructor({endpoint, httpInterval = 1000, jsonEncoder = JSON_V1}) {
    this.endpoint = endpoint;
    this.queue = [];
    this.jsonEncoder = jsonEncoder;

    const timer = setInterval(() => {
      this.processQueue();
    }, httpInterval);
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  logSpan(span) {
    this.queue.push(this.jsonEncoder.encode(span));
  }

  processQueue() {
    if (this.queue.length > 0) {
      const postBody = `[${this.queue.join(',')}]`;
      fetch(this.endpoint, {
        method: 'POST',
        body: postBody,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        if (response.status !== 202) {
          console.error('Unexpected response while sending Zipkin data, status:' +
            `${response.status}, body: ${postBody}`);
        }
      }).catch((error) => {
        console.error('Error sending Zipkin data', error);
      });
      this.queue.length = 0;
    }
  }
}

module.exports = HttpLogger;
