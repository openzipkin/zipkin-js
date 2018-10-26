(function (global, factory) {
            typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
            typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (factory((global.zipkin = {})));
}(this, (function (exports) { 'use strict';

            var global$1 = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

            /* eslint-disable no-console */
            var globalFetch = typeof window !== 'undefined' && window.fetch || typeof global$1 !== 'undefined' && global$1.fetch;

            // eslint-disable-next-line global-require
            var fetch = globalFetch || require('node-fetch');

            var _require = require('zipkin'),
                JSON_V1 = _require.jsonEncoder.JSON_V1;

            var EventEmitter = require('events').EventEmitter;

            var HttpLogger = function (_EventEmitter) {
              babelHelpers.inherits(HttpLogger, _EventEmitter);

              function HttpLogger(_ref) {
                var endpoint = _ref.endpoint,
                    _ref$headers = _ref.headers,
                    headers = _ref$headers === undefined ? {} : _ref$headers,
                    _ref$httpInterval = _ref.httpInterval,
                    httpInterval = _ref$httpInterval === undefined ? 1000 : _ref$httpInterval,
                    _ref$jsonEncoder = _ref.jsonEncoder,
                    jsonEncoder = _ref$jsonEncoder === undefined ? JSON_V1 : _ref$jsonEncoder,
                    _ref$timeout = _ref.timeout,
                    timeout = _ref$timeout === undefined ? 0 : _ref$timeout;
                babelHelpers.classCallCheck(this, HttpLogger);

                // must be before any reference to *this*
                var _this = babelHelpers.possibleConstructorReturn(this, (HttpLogger.__proto__ || Object.getPrototypeOf(HttpLogger)).call(this));

                _this.endpoint = endpoint;
                _this.queue = [];
                _this.jsonEncoder = jsonEncoder;

                _this.errorListenerSet = false;

                _this.headers = Object.assign({
                  'Content-Type': 'application/json'
                }, headers);

                // req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies)
                // only supported by node-fetch; silently ignored by browser fetch clients
                // @see https://github.com/bitinn/node-fetch#fetch-options
                _this.timeout = timeout;

                var timer = setInterval(function () {
                  _this.processQueue();
                }, httpInterval);
                if (timer.unref) {
                  // unref might not be available in browsers
                  timer.unref(); // Allows Node to terminate instead of blocking on timer
                }
                return _this;
              }

              babelHelpers.createClass(HttpLogger, [{
                key: 'on',
                value: function on() {
                  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                  }

                  var eventName = args[0];
                  // if the instance has an error handler set then we don't need to
                  // console.log errors anymore
                  if (eventName.toLowerCase() === 'error') this.errorListenerSet = true;
                  babelHelpers.get(HttpLogger.prototype.__proto__ || Object.getPrototypeOf(HttpLogger.prototype), 'on', this).apply(this, args);
                }
              }, {
                key: 'logSpan',
                value: function logSpan(span) {
                  this.queue.push(this.jsonEncoder.encode(span));
                }
              }, {
                key: 'processQueue',
                value: function processQueue() {
                  var _this2 = this;

                  var self = this;
                  if (self.queue.length > 0) {
                    var postBody = '[' + self.queue.join(',') + ']';
                    fetch(self.endpoint, {
                      method: 'POST',
                      body: postBody,
                      headers: self.headers,
                      timeout: self.timeout
                    }).then(function (response) {
                      if (response.status !== 202 && response.status !== 200) {
                        var err = 'Unexpected response while sending Zipkin data, status:' + (response.status + ', body: ' + postBody);

                        if (self.errorListenerSet) _this2.emit('error', new Error(err));else console.error(err);
                      } else {
                        _this2.emit('success', response);
                      }
                    }).catch(function (error) {
                      var err = 'Error sending Zipkin data ' + error;
                      if (self.errorListenerSet) _this2.emit('error', new Error(err));else console.error(err);
                    });
                    self.queue.length = 0;
                  }
                }
              }]);
              return HttpLogger;
            }(EventEmitter);

            module.exports = HttpLogger;

            var HttpLogger$1 = /*#__PURE__*/Object.freeze({

            });

            var HttpLogger$2 = HttpLogger$1;

            var src = {
            	HttpLogger: HttpLogger$2
            };

            exports.default = src;
            exports.HttpLogger = HttpLogger$2;

            Object.defineProperty(exports, '__esModule', { value: true });

})));
