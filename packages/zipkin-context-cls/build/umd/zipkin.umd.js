(function (global, factory) {
            typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
            typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (factory((global.zipkin = {})));
}(this, (function (exports) { 'use strict';

            var global$1 = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

            // shim for using process in browser
            // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

            function defaultSetTimout() {
                throw new Error('setTimeout has not been defined');
            }
            function defaultClearTimeout() {
                throw new Error('clearTimeout has not been defined');
            }
            var cachedSetTimeout = defaultSetTimout;
            var cachedClearTimeout = defaultClearTimeout;
            if (typeof global$1.setTimeout === 'function') {
                cachedSetTimeout = setTimeout;
            }
            if (typeof global$1.clearTimeout === 'function') {
                cachedClearTimeout = clearTimeout;
            }

            function runTimeout(fun) {
                if (cachedSetTimeout === setTimeout) {
                    //normal enviroments in sane situations
                    return setTimeout(fun, 0);
                }
                // if setTimeout wasn't available but was latter defined
                if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
                    cachedSetTimeout = setTimeout;
                    return setTimeout(fun, 0);
                }
                try {
                    // when when somebody has screwed with setTimeout but no I.E. maddness
                    return cachedSetTimeout(fun, 0);
                } catch (e) {
                    try {
                        // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                        return cachedSetTimeout.call(null, fun, 0);
                    } catch (e) {
                        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                        return cachedSetTimeout.call(this, fun, 0);
                    }
                }
            }
            function runClearTimeout(marker) {
                if (cachedClearTimeout === clearTimeout) {
                    //normal enviroments in sane situations
                    return clearTimeout(marker);
                }
                // if clearTimeout wasn't available but was latter defined
                if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
                    cachedClearTimeout = clearTimeout;
                    return clearTimeout(marker);
                }
                try {
                    // when when somebody has screwed with setTimeout but no I.E. maddness
                    return cachedClearTimeout(marker);
                } catch (e) {
                    try {
                        // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                        return cachedClearTimeout.call(null, marker);
                    } catch (e) {
                        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                        // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                        return cachedClearTimeout.call(this, marker);
                    }
                }
            }
            var queue = [];
            var draining = false;
            var currentQueue;
            var queueIndex = -1;

            function cleanUpNextTick() {
                if (!draining || !currentQueue) {
                    return;
                }
                draining = false;
                if (currentQueue.length) {
                    queue = currentQueue.concat(queue);
                } else {
                    queueIndex = -1;
                }
                if (queue.length) {
                    drainQueue();
                }
            }

            function drainQueue() {
                if (draining) {
                    return;
                }
                var timeout = runTimeout(cleanUpNextTick);
                draining = true;

                var len = queue.length;
                while (len) {
                    currentQueue = queue;
                    queue = [];
                    while (++queueIndex < len) {
                        if (currentQueue) {
                            currentQueue[queueIndex].run();
                        }
                    }
                    queueIndex = -1;
                    len = queue.length;
                }
                currentQueue = null;
                draining = false;
                runClearTimeout(timeout);
            }
            function nextTick(fun) {
                var args = new Array(arguments.length - 1);
                if (arguments.length > 1) {
                    for (var i = 1; i < arguments.length; i++) {
                        args[i - 1] = arguments[i];
                    }
                }
                queue.push(new Item(fun, args));
                if (queue.length === 1 && !draining) {
                    runTimeout(drainQueue);
                }
            }
            // v8 likes predictible objects
            function Item(fun, array) {
                this.fun = fun;
                this.array = array;
            }
            Item.prototype.run = function () {
                this.fun.apply(null, this.array);
            };
            var title = 'browser';
            var platform = 'browser';
            var browser = true;
            var env = {};
            var argv = [];
            var version = ''; // empty string to avoid regexp issues
            var versions = {};
            var release = {};
            var config = {};

            function noop() {}

            var on = noop;
            var addListener = noop;
            var once = noop;
            var off = noop;
            var removeListener = noop;
            var removeAllListeners = noop;
            var emit = noop;

            function binding(name) {
                throw new Error('process.binding is not supported');
            }

            function cwd() {
                return '/';
            }
            function chdir(dir) {
                throw new Error('process.chdir is not supported');
            }function umask() {
                return 0;
            }

            // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
            var performance = global$1.performance || {};
            var performanceNow = performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function () {
                return new Date().getTime();
            };

            // generate timestamp or delta
            // see http://nodejs.org/api/process.html#process_process_hrtime
            function hrtime(previousTimestamp) {
                var clocktime = performanceNow.call(performance) * 1e-3;
                var seconds = Math.floor(clocktime);
                var nanoseconds = Math.floor(clocktime % 1 * 1e9);
                if (previousTimestamp) {
                    seconds = seconds - previousTimestamp[0];
                    nanoseconds = nanoseconds - previousTimestamp[1];
                    if (nanoseconds < 0) {
                        seconds--;
                        nanoseconds += 1e9;
                    }
                }
                return [seconds, nanoseconds];
            }

            var startTime = new Date();
            function uptime() {
                var currentTime = new Date();
                var dif = currentTime - startTime;
                return dif / 1000;
            }

            var process = {
                nextTick: nextTick,
                title: title,
                browser: browser,
                env: env,
                argv: argv,
                version: version,
                versions: versions,
                on: on,
                addListener: addListener,
                once: once,
                off: off,
                removeListener: removeListener,
                removeAllListeners: removeAllListeners,
                emit: emit,
                binding: binding,
                cwd: cwd,
                chdir: chdir,
                umask: umask,
                hrtime: hrtime,
                platform: platform,
                release: release,
                config: config,
                uptime: uptime
            };

            var assert      = require('assert');
            var wrapEmitter = require('emitter-listener');

            /*
             *
             * CONSTANTS
             *
             */
            var CONTEXTS_SYMBOL = 'cls@contexts';
            var ERROR_SYMBOL = 'error@context';

            // load polyfill if native support is unavailable
            require('async-listener');

            function Namespace(name) {
              this.name   = name;
              // changed in 2.7: no default context
              this.active = null;
              this._set   = [];
              this.id     = null;
            }

            Namespace.prototype.set = function (key, value) {
              if (!this.active) {
                throw new Error("No context available. ns.run() or ns.bind() must be called first.");
              }

              this.active[key] = value;
              return value;
            };

            Namespace.prototype.get = function (key) {
              if (!this.active) return undefined;

              return this.active[key];
            };

            Namespace.prototype.createContext = function () {
              return Object.create(this.active);
            };

            Namespace.prototype.run = function (fn) {
              var context = this.createContext();
              this.enter(context);
              try {
                fn(context);
                return context;
              }
              catch (exception) {
                if (exception) {
                  exception[ERROR_SYMBOL] = context;
                }
                throw exception;
              }
              finally {
                this.exit(context);
              }
            };

            Namespace.prototype.runAndReturn = function (fn) {
              var value;
              this.run(function (context) {
                value = fn(context);
              });
              return value;
            };

            Namespace.prototype.bind = function (fn, context) {
              if (!context) {
                if (!this.active) {
                  context = this.createContext();
                }
                else {
                  context = this.active;
                }
              }

              var self = this;
              return function () {
                self.enter(context);
                try {
                  return fn.apply(this, arguments);
                }
                catch (exception) {
                  if (exception) {
                    exception[ERROR_SYMBOL] = context;
                  }
                  throw exception;
                }
                finally {
                  self.exit(context);
                }
              };
            };

            Namespace.prototype.enter = function (context) {
              assert.ok(context, "context must be provided for entering");

              this._set.push(this.active);
              this.active = context;
            };

            Namespace.prototype.exit = function (context) {
              assert.ok(context, "context must be provided for exiting");

              // Fast path for most exits that are at the top of the stack
              if (this.active === context) {
                assert.ok(this._set.length, "can't remove top context");
                this.active = this._set.pop();
                return;
              }

              // Fast search in the stack using lastIndexOf
              var index = this._set.lastIndexOf(context);

              assert.ok(index >= 0, "context not currently entered; can't exit");
              assert.ok(index,      "can't remove top context");

              this._set.splice(index, 1);
            };

            Namespace.prototype.bindEmitter = function (emitter) {
              assert.ok(emitter.on && emitter.addListener && emitter.emit, "can only bind real EEs");

              var namespace  = this;
              var thisSymbol = 'context@' + this.name;

              // Capture the context active at the time the emitter is bound.
              function attach(listener) {
                if (!listener) return;
                if (!listener[CONTEXTS_SYMBOL]) listener[CONTEXTS_SYMBOL] = Object.create(null);

                listener[CONTEXTS_SYMBOL][thisSymbol] = {
                  namespace : namespace,
                  context   : namespace.active
                };
              }

              // At emit time, bind the listener within the correct context.
              function bind(unwrapped) {
                if (!(unwrapped && unwrapped[CONTEXTS_SYMBOL])) return unwrapped;

                var wrapped  = unwrapped;
                var contexts = unwrapped[CONTEXTS_SYMBOL];
                Object.keys(contexts).forEach(function (name) {
                  var thunk = contexts[name];
                  wrapped = thunk.namespace.bind(wrapped, thunk.context);
                });
                return wrapped;
              }

              wrapEmitter(emitter, attach, bind);
            };

            /**
             * If an error comes out of a namespace, it will have a context attached to it.
             * This function knows how to find it.
             *
             * @param {Error} exception Possibly annotated error.
             */
            Namespace.prototype.fromException = function (exception) {
              return exception[ERROR_SYMBOL];
            };

            function get(name) {
              return process.namespaces[name];
            }

            function create(name) {
              assert.ok(name, "namespace must be given a name!");

              var namespace = new Namespace(name);
              namespace.id = process.addAsyncListener({
                create : function () { return namespace.active; },
                before : function (context, storage) { if (storage) namespace.enter(storage); },
                after  : function (context, storage) { if (storage) namespace.exit(storage); },
                error  : function (storage) { if (storage) namespace.exit(storage); }
              });

              process.namespaces[name] = namespace;
              return namespace;
            }

            function destroy(name) {
              var namespace = get(name);

              assert.ok(namespace,    "can't delete nonexistent namespace!");
              assert.ok(namespace.id, "don't assign to process.namespaces directly!");

              process.removeAsyncListener(namespace.id);
              process.namespaces[name] = null;
            }

            function reset() {
              // must unregister async listeners
              if (process.namespaces) {
                Object.keys(process.namespaces).forEach(function (name) {
                  destroy(name);
                });
              }
              process.namespaces = Object.create(null);
            }
            if (!process.namespaces) reset(); // call immediately to set up

            module.exports = {
              getNamespace     : get,
              createNamespace  : create,
              destroyNamespace : destroy,
              reset            : reset
            };

            var context = /*#__PURE__*/Object.freeze({

            });

            var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

            function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

            var createNamespace = context.createNamespace,
                getNamespace = context.getNamespace;

            var CLSContext = function () {
              function CLSContext() {
                var namespace = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'zipkin';

                _classCallCheck(this, CLSContext);

                this._session = getNamespace(namespace) || createNamespace(namespace);
                var defaultContext = this._session.createContext();
                this._session.enter(defaultContext);
              }

              _createClass(CLSContext, [{
                key: 'setContext',
                value: function setContext(ctx) {
                  this._session.set('zipkin', ctx);
                }
              }, {
                key: 'getContext',
                value: function getContext() {
                  var currentCtx = this._session.get('zipkin');
                  if (currentCtx != null) {
                    return currentCtx;
                  } else {
                    return null; // explicitly return null (not undefined)
                  }
                }
              }, {
                key: 'scoped',
                value: function scoped(callable) {
                  var result = void 0;
                  this._session.run(function () {
                    result = callable();
                  });
                  return result;
                }
              }, {
                key: 'letContext',
                value: function letContext(ctx, callable) {
                  var _this = this;

                  return this.scoped(function () {
                    _this.setContext(ctx);
                    return callable();
                  });
                }
              }]);

              return CLSContext;
            }();

            exports.default = CLSContext;

            Object.defineProperty(exports, '__esModule', { value: true });

})));
