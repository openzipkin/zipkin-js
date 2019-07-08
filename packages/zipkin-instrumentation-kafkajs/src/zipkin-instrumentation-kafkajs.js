const {Request} = require('zipkin');
const {
  recordConsumeStop, recordConsumeStart,
  recordProducerStart, recordProducerStop
} = require('./kafka-recorder.js');

const instrumentKafkaJs = (kafkaJs, {tracer, remoteServiceName}) => {
  const consumerRunHandler = {
    get: (obj, prop) => {
      if (prop === 'eachMessage') {
        return function(params) {
          let id;
          let promise;
          tracer.scoped(() => {
            id = recordConsumeStart(tracer, 'each-message', remoteServiceName, params);
            promise = obj[prop](params);
          });
          promise.then(() => {
            recordConsumeStop(tracer, id);
          }).catch((error) => {
            // for some reason, the actual error isn't propagated and instead just undefined
            recordConsumeStop(tracer, id, error || '');
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
            id = recordProducerStart(tracer, 'send', remoteServiceName, {topic: params.topic});

            const withTraceHeaders = Object.assign({}, params, {
              messages: params.messages.map(msg => Request.addZipkinHeaders(msg, id))
            });

            promise = obj[prop](withTraceHeaders);
          });
          promise.then(() => {
            recordProducerStop(tracer, id);
          }).catch((error) => {
            // for some reason, the actual error isn't propagated and instead just undefined
            recordProducerStop(tracer, id, error || '');
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
