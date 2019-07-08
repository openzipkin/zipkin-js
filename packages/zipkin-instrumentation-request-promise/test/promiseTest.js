import {assert} from 'chai';
import {Deferred, Promise as CustomPromise} from '../src/promise';
import {makeTracer} from './utils';

const EMPTY_OBJ = {};
const promise = new CustomPromise((resolve) => {
  resolve(EMPTY_OBJ);
});

describe(__filename, () => {
  describe('Deferred', () => {
    const tracer = makeTracer();
    it('Callbacks should run in order', () => {
      const t = new Deferred(tracer);
      const p = t.promise;
      p.then((data) => {
        assert.equal(data, 35);
        return 40;
      }).then((data) => {
        assert.equal(data, 40);
        return Promise.resolve(600);
      }).then((data) => {
        assert.equal(data, 600);
      });
      t.resolve(35);
      return t;
    });
  });

  describe('Promise', () => {
    it('Callbacks should not run', function callback(done) {
      this.timeout(3000);
      const p = new Promise(() => null);
      p.then(() => done(false))
        .catch(() => done(false))
        .finally(() => {
          done(false);
        });
      setTimeout(done, 2000);
    });
    it('Throwing error should reject the promise', () => new CustomPromise(() => {
      throw new Error('Life is ruff');
    }).catch((e) => {
      assert.equal('Life is ruff', e.message);
    }));
    it('Chaining callbacks', (done) => {
      const p1 = new CustomPromise((resolve) => {
        resolve(100);
      });
      p1.then((value) => {
        assert.equal(100, value);
        return 43;
      }).then((value) => {
        assert.equal(43, value);
        return Promise.reject(new Error(-90));
      }).then(() => {
        assert.isFalse('Callback should not run');
      })
        .catch((err) => {
          assert.equal(-90, err.message);
          done();
        });
    });
  });

  describe('The Promise Constructor', () => {
    it('has `Object.getPrototypeOf(promise) === Promise.prototype`', () => {
      assert(Object.getPrototypeOf(promise) === CustomPromise.prototype);
    });
    it('has `promise.constructor === Promise`', () => {
      assert(promise.constructor === CustomPromise);
    });
    it('has `promise.constructor === Promise.prototype.constructor`', () => {
      assert(promise.constructor === CustomPromise.prototype.constructor);
    });
    it('has `Promise.length === 1`', () => {
      assert(CustomPromise.length === 1);
    });
    describe('if resolver is not a function', () => {
      it('must throw a `TypeError`', () => {
        try {
          new CustomPromise({}); // eslint-disable-line no-new
        } catch (ex) {
          assert(ex instanceof TypeError);
          return;
        }
        throw new Error('Should have thrown a TypeError');
      });
    });
    describe('if resolver is a function', () => {
      it('must be called with the promise\'s resolver arguments', (done) => {
        new CustomPromise((resolve, reject) => { // eslint-disable-line no-new
          assert(typeof resolve === 'function');
          assert(typeof reject === 'function');
          done();
        });
      });
      it('must be called immediately, before `Promise` returns', () => {
        let called = false;
        new CustomPromise(() => { // eslint-disable-line no-new
          called = true;
        });
        assert(called);
      });
    });
    describe('Calling resolve(x)', () => {
      describe('if promise is resolved', () => {
        it('nothing happens', (done) => {
          const thenable = {
            then: (onComplete) => {
              setTimeout(() => {
                onComplete(EMPTY_OBJ);
              }, 50);
            },
          };
          new CustomPromise((resolve) => {
            process.nextTick(() => {
              resolve(thenable);
              resolve(null);
            });
          })
            .then((result) => {
              assert(result === EMPTY_OBJ);
            })
            .then(() => {
              done();
            }, (err) => {
              done(err || new Error('Promise rejected'));
            });
        });
      });
      describe('otherwise', () => {
        describe('if x is a thenable', () => {
          it('assimilates the thenable', () => {

          });
        });
        describe('otherwise', () => {
          it('is fulfilled with x as the fulfillment value', (done) => {
            new CustomPromise((resolve) => {
              resolve(EMPTY_OBJ);
            })
              .then((fulfillmentValue) => {
                assert(fulfillmentValue === EMPTY_OBJ);
              })
              .then(() => {
                done();
              }, (err) => {
                done(err || new Error('Promise rejected'));
              });
          });
        });
      });
    });
    describe('Calling reject(x)', () => {
      describe('if promise is resolved', () => {
        it('nothing happens', (done) => {
          const thenable = {
            then: (onComplete) => {
              setTimeout(() => {
                onComplete(EMPTY_OBJ);
              }, 50);
            },
          };
          new CustomPromise((resolve, reject) => {
            process.nextTick(() => {
              resolve(thenable);
              reject(new Error('foo'));
            });
          })
            .then((result) => {
              assert(result === EMPTY_OBJ);
            })
            .then(() => {
              done();
            }, (err) => {
              done(err || new Error('Promise rejected'));
            });
        });
      });
      describe('otherwise', () => {
        it('is rejected with x as the rejection reason', (done) => {
          new CustomPromise((resolve, reject) => {
            reject(EMPTY_OBJ);
          })
            .then(null, (rejectionReason) => {
              assert(rejectionReason === EMPTY_OBJ);
            })
            .then(() => {
              done();
            }, (err) => {
              done(err || new Error('Promise rejected'));
            });
        });
      });
    });
  });
  describe('if resolver throws', () => {
    describe('if promise is resolved', () => {
      it('nothing happens', (done) => {
        const thenable = {
          then: (onComplete) => {
            setTimeout(() => {
              onComplete(EMPTY_OBJ);
            }, 50);
          },
        };
        new CustomPromise((resolve) => {
          resolve(thenable);
          throw new Error('foo');
        })
          .then((result) => {
            assert(result === EMPTY_OBJ);
          })
          .then(() => {
            done();
          }, (err) => {
            done(err || new Error('Promise rejected'));
          });
      });
    });
    describe('otherwise', () => {
      it('is rejected with e as the rejection reason', (done) => {
        new CustomPromise(() => {
          throw EMPTY_OBJ;
        })
          .then(null, (rejectionReason) => {
            assert(rejectionReason === EMPTY_OBJ);
          })
          .then(() => {
            done();
          }, (err) => {
            done(err || new Error('Promise rejected'));
          });
      });
    });
  });
});
