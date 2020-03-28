const AWS = require('aws-sdk');
const {jsonEncoder: {JSON_V2}} = require('zipkin');
const {EventEmitter} = require('events');

class AwsSqsLogger extends EventEmitter {
  constructor(options) {
    super();
    this.log = options.log || console;
    this.delaySeconds = options.delaySeconds || 0;
    this.pollerSeconds = options.pollerSeconds || 100;
    this.queue = [];
    this.queueBytes = 0;
    this.errorListenerSet = false;
    this.maxPayloadSize = 256 * 1024; // Max Payload size per message is 256KB, limit from AWS SQS
    this.queueUrl = options.queueUrl;
    this.encoder = JSON_V2;
    if (typeof options.awsConfig !== 'undefined') {
      AWS.config.update(options.awsConfig);
    }
    this.awsClient = new AWS.SQS();

    const timer = setInterval(() => {
      this.processQueue();
    }, this.pollerSeconds);
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  _getPayloadSize(encodedSpan) {
    // Our payload is in format '[s1,s2,s3]', so we need to add 2 brackets and
    // one comma separator for each payload, including the next span if defined
    return encodedSpan
      ? this.queueBytes + 2 + this.queue.length + encodedSpan.length
      : this.queueBytes + 2 + Math.min(this.queue.length - 1, 0);
  }

  on(...args) {
    const eventName = args[0];
    // if the instance has an error handler set then we don't need to
    // skips error logging
    if (eventName.toLowerCase() === 'error') {
      this.errorListenerSet = true;
    }
    super.on.apply(this, args);
  }

  logSpan(span) {
    const encodedSpan = this.encoder.encode(span);
    const payloadSize = this._getPayloadSize(encodedSpan);
    if (payloadSize >= this.maxPayloadSize) {
      this.processQueue();
      if (payloadSize > this.maxPayloadSize) {
        // Payload size is too large even with an empty queue, we can only drop
        const err = 'Zipkin span got dropped, reason: payload too large';
        if (this.errorListenerSet) {
          this.emit('error', new Error(err));
        } else {
          this.log.error(err);
        }
        return;
      }
    }
    this.queue.push(encodedSpan);
    this.queueBytes += encodedSpan.length;
  }

  processQueue() {
    if (this.queue.length !== 0) {
      const body = {
        MessageBody: `[${this.queue.join(',')}]`,
        QueueUrl: this.queueUrl,
        DelaySeconds: 0
      };
      this.awsClient.sendMessage(body, (err, res) => {
        if (res) {
          this.emit('success', res);
        } else {
          this.log.error(err);
          if (this.errorListenerSet) {
            this.emit('error', new Error(err));
          }
        }
      });
      this.queue.length = 0;
      this.queueBytes = 0;
    }
  }
}

module.exports = AwsSqsLogger;
