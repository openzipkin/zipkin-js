const AWS = require('aws-sdk');
const {jsonEncoder: {JSON_V2}} = require('zipkin');
const {EventEmitter} = require('events');

class AwsSqsLogger extends EventEmitter {
  constructor(builder) {
    super();
    this.log = builder.log || console;
    this.delaySeconds = builder.delaySeconds || 0;
    this.pollerSeconds = builder.pollerSeconds || 100;
    this.queue = [];
    this.queueBytes = 0;
    this.errorListenerSet = false;
    this.encoding = JSON_V2;
    this.messageMaxBytes = 256 * 1024; // Max Payload size per message is 256KB, limit from AWS SQS
    if (typeof builder.queueUrl !== 'undefined') {
      this.queueUrl = builder.queueUrl;
    } else {
      throw new Error('queueUrl is mandatory');
    }
    const config = new AWS.Config();
    if (typeof builder.region !== 'undefined') {
      config.update({region: builder.region});
    }
    if (typeof builder.credentialsProvider !== 'undefined') {
      config.update({credentialProvider: builder.credentialProvider});
    }
    if (typeof builder.endpointConfiguration !== 'undefined') {
      config.update({endpoint: builder.endpointConfiguration});
    }
    this.awsClient = new AWS.SQS(config);

    const timer = setInterval(() => {
      this.processQueue();
    }, this.pollerSeconds);
    if (timer.unref) { // unref might not be available in browsers
      timer.unref(); // Allows Node to terminate instead of blocking on timer
    }
  }

  static builder() {
    return new class Builder {
      queueUrl(queueUrl) {
        this.queueUrl = queueUrl;
        return this;
      }

      region(region) {
        this.region = region;
        return this;
      }

      credentialsProvider(credentialsProvider) {
        this.credentialsProvider = credentialsProvider;
        return this;
      }

      endpointConfiguration(endpointConfiguration) {
        this.endpointConfiguration = endpointConfiguration;
        return this;
      }

      delaySeconds(delaySeconds) {
        this.delaySeconds = delaySeconds;
        return this;
      }

      pollerSeconds(pollerSeconds) {
        this.pollerSeconds = pollerSeconds;
        return this;
      }

      log(log) {
        this.log = log;
        return this;
      }

      build() {
        return new AwsSqsLogger(this);
      }
    }();
  }

  _getPayloadSize(encodedSpan) {
    // Our payload is in format '[s1,s2,s3]', so we need to add 2 brackets and
    // one comma separator for each payload, including the next span if defined
    return encodedSpan
      ? this.queueBytes + 2 + this.queue.length + encodedSpan.length
      : this.queueBytes + 2 + Math.min(this.queue.length - 1, 0);
  }

  on(eventName, listener) {
    // if the instance has an error handler set then we don't need to
    // skips error logging
    if (eventName.toLowerCase() === 'error') {
      this.errorListenerSet = true;
    }
    super.on.call(this, eventName, listener);
  }

  logSpan(span) {
    const encodedSpan = this.encoding.encode(span);
    if (this._getPayloadSize(encodedSpan) >= this.messageMaxBytes) {
      this.processQueue();
      if (this._getPayloadSize(encodedSpan) > this.messageMaxBytes) {
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
    if (this.queue.length === 0) {
      return undefined;
    }

    const body = {
      MessageBody: `[${this.queue.join(',')}]`,
      QueueUrl: this.queueUrl,
      DelaySeconds: this.delaySeconds
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
    /*
     array = [] creates a new array and assigns a reference to it.
     array.length = 0 modifies the array itself.
     */
    this.queue.length = 0;
    this.queueBytes = 0;
    return undefined;
  }
}

module.exports = AwsSqsLogger;
