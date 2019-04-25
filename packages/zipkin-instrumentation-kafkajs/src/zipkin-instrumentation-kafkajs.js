const {
  recordConsumeStop, recordConsumeStart,
  recordProducerStart, recordProducerStop
} = require('./kafka-recorder.js');
const {Request} = require('zipkin');

const instrumentKafkaJs = (kafkaJs, {tracer, remoteServiceName}) => {
  const consumerRunHandler = {
    get: (obj, prop) => {
      if (prop === 'eachMessage') {
        return function(params) {
          let id;
          let promise;
          tracer.scoped(() => {
            id = recordConsumeStart(tracer, params);
            promise = obj[prop](params);
          });
          promise.then(() => {
            recordConsumeStop(tracer, id);
          }).catch((error) => {
            recordConsumeStop(tracer, id, error || 'unknown');
          });
          return promise;
        };
      }
      return obj[prop];
    }
  };

  const consumerHandler = {
    get: (obj, prop) => {
      if (prop === 'run') {
        return function(params) {
          return obj[prop](new Proxy(params, consumerRunHandler));
        };
      }
      return obj[prop];
    }
  };

  const producerHandler = {
    get: (obj, prop) => {
      if (prop === 'send') {
        return function(params) {
          let id;
          let promise;
          tracer.scoped(() => {
            id = recordProducerStart(tracer, remoteServiceName, {topic: params.topic});
            const instrumentedMessages = params.messages.map((msg) =>
              Request.addZipkinHeaders(msg, id));
            promise = obj[prop](Object.assign({}, params, {messages: instrumentedMessages}));
          });
          promise.then(() => {
            recordProducerStop(tracer, id);
          }).catch((error) => {
            recordProducerStop(tracer, id, error || 'unknown');
          });
          return promise;
        };
      }
      return obj[prop];
    }
  };

  const kafkaHandler = {
    get: (obj, prop) => {
      if (prop === 'consumer') {
        return function(params) {
          return new Proxy(obj[prop](params), consumerHandler);
        };
      }
      if (prop === 'producer') {
        return function(params) {
          return new Proxy(obj[prop](params), producerHandler);
        };
      }
      return obj[prop];
    }
  };

  return new Proxy(kafkaJs, kafkaHandler);
};

module.exports = instrumentKafkaJs;
