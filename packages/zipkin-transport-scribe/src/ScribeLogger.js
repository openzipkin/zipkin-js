/* eslint-disable no-console */
const {Scribe} = require('scribe');
const serializeSpan = require('zipkin-encoder-thrift');

function ScribeLogger({scribeHost, scribePort = 9410, scribeInterval = 1000}) {
  const scribeClient = new Scribe(scribeHost, scribePort, {autoReconnect: true});
  scribeClient.on('error', () => {});

  this.queue = [];

  setInterval(() => {
    if (this.queue.length > 0) {
      try {
        scribeClient.open(err => {
          if (err) {
            console.error('Error writing Zipkin data to Scribe', err);
          } else {
            this.queue.forEach(span => {
              scribeClient.send('zipkin', serializeSpan(span));
            });
            scribeClient.flush();
            this.queue.length = 0;
          }
        });
      } catch (err) {
        console.error('Error writing Zipkin data to Scribe', err);
      }
    }
  }, scribeInterval);
}
ScribeLogger.prototype.logSpan = function logSpan(span) {
  this.queue.push(span);
};

module.exports = ScribeLogger;
