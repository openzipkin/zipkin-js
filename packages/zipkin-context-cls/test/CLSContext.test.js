const CLSContext = require('../');

describe('CLSContext', () => {
  it('should start with context null', () => {
    const ctx = new CLSContext();
    expect(ctx.getContext()).to.equal(null);
  });

  it('should set an inner context', () => {
    const ctx = new CLSContext();
    ctx.letContext('foo', () => {
      expect(ctx.getContext()).to.equal('foo');
    });
  });

  it('should set an inner context with setContext', () => {
    const ctx = new CLSContext();
    ctx.scoped(() => {
      ctx.setContext('bla');
      expect(ctx.getContext()).to.equal('bla');
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('should return the inner value', () => {
    const ctx = new CLSContext();
    const returnValue = ctx.letContext('foo', () => 123);
    expect(returnValue).to.equal(123);
  });

  it('should be reset after the callback', () => {
    const ctx = new CLSContext();
    ctx.letContext('foo', () => {
      // do nothing
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('should reset after error in callback', () => {
    const ctx = new CLSContext();

    let error;
    try {
      ctx.letContext('buy-smoothie', () => {
        throw new Error('no smoothies. try our cake');
      });
    } catch (err) {
      error = err; // error wasn't swallowed
    }

    // sanity check
    expect(error.message).to.eql('no smoothies. try our cake');

    // context wasn't leaked
    expect(ctx.getContext()).to.equal(null);
  });

  it('support nested contexts', () => {
    const ctx = new CLSContext();
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

  it('supports CLS contexts (setTimeout etc)', (done) => {
    const ctx = new CLSContext();
    function callback() {
      expect(ctx.getContext()).to.equal('foo');
      done();
    }
    ctx.letContext('foo', () => {
      setTimeout(callback, 10);
    });
  });
  it('should support async-await', async () => {
    const ctx = new CLSContext();

    async function log() {
      return ctx.getContext();
    }

    async function afn() {
      const cid1 = await log(1);
      const cid2 = await log(2);
      return {cid1, cid2};
    }

    async function newP(id) {
      const {cid1, cid2} = await ctx.letContext(id, () => afn());
      expect(cid1).to.not.equal(null);
      expect(cid2).to.not.equal(null);
    }
    await newP(1); // eslint-disable-line
  });
});
