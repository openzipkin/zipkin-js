/* eslint-disable no-console */
const fetch = require('node-fetch');

class HttpLogger {
  constructor({endpoint, httpInterval = 1000}) {
    this.endpoint = endpoint;
    this.queue = [];
    this.httpInterval = httpInterval;

    const timer = setInterval(() => {
      this.processQueue();
    }, httpInterval);
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  logSpan(span) {
    this.queue.push(span.toJSON());

    // Schedule a timeout so logs will also be processed
    // when the node process is about to exit
    this.timeoutTimer = setTimeout(() => {}, this.httpInterval);
  }

  processQueue() {
    if (this.queue.length > 0) {
      const postBody = JSON.stringify(this.queue);
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
        this.queue.length = 0;

        // Clear the timeout timer when the queue is empty so
        // if the node process is about to exit, it is not hold back by the timeout
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = null;
      }).catch((error) => {
        console.error('Error sending Zipkin data', error);
        this.queue.length = 0;
      });
    }
  }
}

module.exports = HttpLogger;
