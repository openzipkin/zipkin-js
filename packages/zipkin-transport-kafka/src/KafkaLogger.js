const kafka = require('kafka-node');
const serializeSpan = require('zipkin-encoder-thrift');

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
    this.producerPromise = new Promise((resolve, reject) => {
      this.topic = options.topic || 'zipkin';
      if (clientOpts.connectionString) {
        this.client = new kafka.Client(
          clientOpts.connectionString, clientOpts.clientId, clientOpts.zkOpts
        );
      } else {
        this.client = new kafka.KafkaClient(clientOpts);
      }
      const producer = new kafka.HighLevelProducer(this.client, producerOpts);
      producer.on('ready', () => resolve(producer));
      producer.on('error', reject);
    });
  }

  logSpan(span) {
    this.producerPromise.then(producer => {
      const data = serializeSpan(span, 'binary');
      producer.send([{
        topic: this.topic,
        messages: data
      }], () => {});
    });
  }

  close() {
    return new Promise(resolve => this.client.close(resolve));
  }
};
