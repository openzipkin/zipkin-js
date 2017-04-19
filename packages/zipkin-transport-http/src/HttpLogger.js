/* eslint-disable no-console */
const fetch = require('node-fetch');

class HttpLogger {
  constructor({endpoint, queueWait = 1000}) {
    this.endpoint = endpoint;
    this.queue = [];
    this.queueWait = queueWait;

    process.on('uncaughtException', (err) => {
      this.processQueue()
        .then(() => {
          console.log(err.stack);
          process.exit(1);
        });
    });
  }

  logSpan(span) {
    this.queue.push(span.toJSON());

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.processQueue();
      }, this.queueWait);
    }
  }

  processQueue() {
    if (this.queue.length > 0) {
      const postBody = JSON.stringify(this.queue);
      return fetch(this.endpoint, {
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
        clearTimeout(this.timer);
        this.timer = null;
      }).catch((error) => {
        console.error('Error sending Zipkin data', error);
        this.queue.length = 0;
      });
    } else {
      return Promise.resolve();
    }
  }
}

module.exports = HttpLogger;
