/* eslint-disable */
// lint disabled until we refactor this file to the point it doesn't crash, or obviate
// by deleting this file.
/**

 IMPORTANT:
 ---------
 The reason `request/request-promise` module breaks the tracing is due to
 the promise losing or not restoring the original execution context.
 You can't override the default Node promise callback execution behavior,
 I won't get into the explanation it's a long story. So I created a promise
 capable to restore the original context before callback execution.

 I wasn't comfortable writing a promise myself from scratch so I found this library
 https://github.com/then/promise/blob/master/src/core.js, then I redesign to create
 this promise.js (I didn't violate the code license). The diff between these files will
 be the code I added.

 SIDE NOTE:
 ---------
 The other instrumented libraries like `zipkin-instrumention-redis` using the default
 promise may have the same context restoration issue.

 */

import asap from 'asap/raw';

const noop = () => {};

// States:
//
// 0 - pending
// 1 - fulfilled with _value
// 2 - rejected with _value
// 3 - adopted the state of another promise, _value
//
// once the state is no longer pending (0) it is immutable

// to avoid using try/catch inside critical functions, we
// extract them to here.
let LAST_ERROR = null;
const IS_ERROR = {};
const getThen = (obj) => {
  try {
    return obj.then;
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
};

const tryCallOne = (fn, a) => {
  try {
    return fn(a);
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
};

const tryCallTwo = (fn, a, b) => {
  try {
    fn(a, b);
    return null;
  } catch (ex) {
    LAST_ERROR = ex;
    return IS_ERROR;
  }
};

function handle(self, deferred) {
  while (self._state === 3) {
    self = self._value;
  }
  if (Promise._onHandle) {
    Promise._onHandle(self);
  }
  if (self._state === 0) {
    if (self._deferredState === 0) {
      self._deferredState = 1;
      self._deferreds = deferred;
      return;
    }
    if (self._deferredState === 1) {
      self._deferredState = 2;
      self._deferreds = [self._deferreds, deferred];
      return;
    }
    self._deferreds.push(deferred);
    return;
  }
  handleResolved(self, deferred);
}

function handleResolved(self, deferred) {
  asap(() => {
    const cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
    if (cb === null) {
      if (self._state === 1) {
        resolve(deferred.promise, self._value);
      } else {
        reject(deferred.promise, self._value);
      }
      return;
    }
    const ret = tryCallOne(cb, self._value);
    if (ret === IS_ERROR) {
      reject(deferred.promise, LAST_ERROR);
    } else {
      resolve(deferred.promise, ret);
    }
  });
}

function finale(self) {
  if (self._deferredState === 1) {
    handle(self, self._deferreds);
    self._deferreds = null;
  }
  if (self._deferredState === 2) {
    for (let i = 0; i < self._deferreds.length; i += 1) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }
}

function resolve(self, newValue) {
  if (newValue === self) {
    return reject(
      self,
      new TypeError('A promise cannot be resolved with itself.')
    );
  }
  if (
    newValue &&
    (typeof newValue === 'object' || typeof newValue === 'function')
  ) {
    const then = getThen(newValue);
    if (then === IS_ERROR) {
      return reject(self, LAST_ERROR);
    }
    if (
      then === self.then &&
      newValue instanceof Promise
    ) {
      self._state = 3;
      self._value = newValue;
      finale(self);
      return null;
    } else if (typeof then === 'function') {
      doResolve(then.bind(newValue), self);
      return null;
    }
  }
  self._state = 1;
  self._value = newValue;
  finale(self);
  return null;
}

function reject(self, newValue) {
  self._state = 2;
  self._value = newValue;
  if (Promise._onReject) {
    Promise._onReject(self, newValue);
  }
  finale(self);
}

/**
 * @class Handler.
 */
class Handler {
  constructor(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
const doResolve = function doResolve(fn, promise) {
  let done = false;
  const res = tryCallTwo(fn, (value) => {
    if (done) return;
    done = true;
    resolve(promise, value);
  }, (reason) => {
    if (done) return;
    done = true;
    reject(promise, reason);
  });
  if (!done && res === IS_ERROR) {
    done = true;
    reject(promise, LAST_ERROR);
  }
};

class Promise {
  constructor(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Promise constructor\'s argument is not a function');
    }
    this._deferredState = 0;
    this._state = 0;
    this._value = null;
    this._deferreds = null;

    this.callbackWrapper = callback => callback;
    if (fn === noop) return;
    doResolve(fn, this);
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }
  then(onFulfilled, onRejected) {
    const res = new this.constructor(noop);
    const wrappedOnFulfilled = this.callbackWrapper(onFulfilled);
    const wrappedOnRejected = this.callbackWrapper(onRejected);
    res.callbackWrapper = this.callbackWrapper;
    handle(this, new Handler(wrappedOnFulfilled, wrappedOnRejected, res));
    return res;
  }
  done(...args) {
    const [onFulfilled, onRejected] = args;
    let self = this;
    if (args.length) {
      self = this.then.apply(this, [onFulfilled, onRejected]);
    }
    self.then(null, (err) => {
      setTimeout(() => {
        throw err;
      }, 0);
    });
  }
  finally(func) {
    return this.then((value) => {
      const val = Promise
        .resolve(func())
        .then(() => value);
      return val;
    }, (err) => {
      const val = Promise
        .resolve(func())
        .then(() => {
          throw err;
        });
      return val;
    });
  }
}

Promise._onHandle = null;
Promise._onReject = null;
Promise._noop = noop;

/**
 * @class Deferred
 */
class Deferred {
  constructor(tracer) {
    this.tracer = tracer;
    const traceId = tracer.id;

    const wrapCallback = (func) => {
      if (typeof func !== 'function') {
        return null;
      }
      return function scopedFunc(...args) {
        return tracer.letId(traceId, () => func.apply(this, args));
      };
    };

    this.promise = new Promise((resv, rejct) => {
      this.resolve = resv;
      this.reject = rejct;
    });
    this.promise.callbackWrapper = wrapCallback;
  }
}

export {Promise, Deferred};
