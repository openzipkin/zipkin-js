const lolex = require('lolex');
const ExplicitContext = require('../src/explicit-context.js');

describe('ExplicitContext', () => {
  it('should start with context null', () => {
    const ctx = new ExplicitContext();
    expect(ctx.getContext()).to.equal(null);
  });

  it('should set an inner context', () => {
    const ctx = new ExplicitContext();
    ctx.letContext('foo', () => {
      expect(ctx.getContext()).to.equal('foo');
    });
  });

  it('should return the inner value', () => {
    const ctx = new ExplicitContext();
    const returnValue = ctx.letContext('foo', () => 123);
    expect(returnValue).to.equal(123);
  });

  it('should be reset after the callback', () => {
    const ctx = new ExplicitContext();
    ctx.letContext('foo', () => {
      // do nothing
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('support nested contexts', () => {
    const ctx = new ExplicitContext();
    const finalReturnValue = ctx.letContext('foo', () => {
      expect(ctx.getContext()).to.equal('foo');
      const innerReturnValue = ctx.letContext('bar', () => {
        expect(ctx.getContext()).to.equal('bar');
        return 1;
      });
      expect(ctx.getContext()).to.equal('foo');
      return innerReturnValue + 2;
    });
    expect(ctx.getContext()).to.equal(null);
    expect(finalReturnValue).to.equal(3);
  });

  it('does not support async context', done => {
    const clock = lolex.install();

    const ctx = new ExplicitContext();
    function callback() {
      expect(ctx.getContext()).to.equal(null);
      done();
    }
    ctx.letContext('foo', () => {
      setTimeout(callback, 10);
    });

    clock.tick(10);
    clock.uninstall();
  });
});
