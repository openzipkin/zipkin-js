const kafka = require('kafka-node');
const THRIFT = require('zipkin-encoder-thrift');
const {jsonEncoder: {JSON_V2}} = require('zipkin');

module.exports = class KafkaLogger {
  constructor(options) {
    const clientDefaults = {
      clientId: 'zipkin-transport-kafka',
      zkOpts: {}
    };
    const clientOpts = Object.assign({}, clientDefaults, options.clientOpts || {});
    const producerDefaults = {
      requireAcks: 0
    };
    /* eslint-disable no-console */
    const log = options.log || console;
    const producerOpts = Object.assign({}, producerDefaults, options.producerOpts || {});
    this.onError = options.onError || function(err) {
      log.error(err);
    };

    if (typeof options.encoder === 'undefined' || options.encoder === THRIFT) {
      this.encoder = THRIFT;
    } else if (options.encoder === JSON_V2) {
      // Temporarily do singleton list messages until logic from the http logger is extracted
      this.encoder = {encode: span => `[${JSON_V2.encode(span)}]`};
    } else {
      throw new Error('Unsupported encoder. Valid choices are THRIFT and JSON_V2.');
    }

    this.topic = options.topic || 'zipkin';

    if (clientOpts.connectionString) {
      this.client = new kafka.Client(
        clientOpts.connectionString, clientOpts.clientId, clientOpts.zkOpts
      );
    } else {
      this.client = new kafka.KafkaClient(clientOpts);
    }
    this.producer = new kafka.HighLevelProducer(this.client, producerOpts);
    this.producerState = 'pending';

    this.producer.on('ready', () => {
      this.producerState = 'ready';
      this.producer.removeAllListeners('ready');
    });

    this.producer.on('error', this.onError);
    this.client.on('error', this.onError);
  }

  logSpan(span) {
    const sendSpan = (data) => {
      this.producer.send([{
        topic: this.topic,
        messages: data,
      }], (err) => {
        if (err) {
          this.onError(err);
        }
      });
    };
    try {
      const encodedSpan = this.encoder.encode(span);
      if (this.producerState === 'ready') {
        sendSpan(encodedSpan);
      } else {
        this.producer.on('ready', () => {
          this.producerState = 'ready';
          sendSpan(encodedSpan);
          this.producer.removeAllListeners('ready');
        });
      }
    } catch (err) {
      this.onError(err);
    }
  }

  close() {
    return new Promise(resolve => this.client.close(resolve));
  }
};
