const kafka = require('kafka-node');
const THRIFT = require('zipkin-encoder-thrift');

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
    const producerOpts = Object.assign({}, producerDefaults, options.producerOpts || {});
    this.onProducerError = options.onProducerError || function(err) { console.error(err); };

    this.topic = options.topic || 'zipkin';
    if (clientOpts.connectionString) {
      this.client = new kafka.Client(
        clientOpts.connectionString, clientOpts.clientId, clientOpts.zkOpts,
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

    this.producer.on('error', this.onProducerError);
  }

  logSpan(span) {
      const data = THRIFT.encode(span);
      if (this.producerState === 'ready') {
        this.producer.send([{
          topic: this.topic,
          messages: data,
        }], () => {});
      } else {
        this.producer.on('ready', () => {
          this.producerState = 'ready';
          this.producer.send([{
            topic: this.topic,
            messages: data,
          }], () => {});
          this.producer.removeAllListeners('ready');
        });
      }
  }

  close() {
    return new Promise(resolve => this.client.close(resolve));
  }
};
