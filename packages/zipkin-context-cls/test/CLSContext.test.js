const CLSContext = require('../');

function CLSContextPerAsync(supportAsync) {
  it('should start with context null', () => {
    const ctx = new CLSContext(supportAsync);
    expect(ctx.getContext()).to.equal(null);
  });

  it('should set an inner context', () => {
    const ctx = new CLSContext(supportAsync);
    ctx.letContext('foo', () => {
      expect(ctx.getContext()).to.equal('foo');
    });
  });

  it('should set an inner context with setContext', () => {
    const ctx = new CLSContext(supportAsync);
    ctx.scoped(() => {
      ctx.setContext('bla');
      expect(ctx.getContext()).to.equal('bla');
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('should return the inner value', () => {
    const ctx = new CLSContext(supportAsync);
    const returnValue = ctx.letContext('foo', () => 123);
    expect(returnValue).to.equal(123);
  });

  it('should be reset after the callback', () => {
    const ctx = new CLSContext(supportAsync);
    ctx.letContext('foo', () => {
      // do nothing
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('should reset after error in callback', () => {
    const ctx = new CLSContext(supportAsync);

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
    const ctx = new CLSContext(supportAsync);
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
    const ctx = new CLSContext(supportAsync);
    function callback() {
      expect(ctx.getContext()).to.equal('foo');
      done();
    }
    ctx.letContext('foo', () => {
      setTimeout(callback, 10);
    });
  });
}

describe('CLSContext', () => {
  
  describe('without async support', function() {
    CLSContextPerAsync(false);
  })

  describe('with async support', function() {
    CLSContextPerAsync(true);

    it('support async-await contexts', async () => {
      const ctx = new CLSContext('zipkin', true);
  
      async function getCtx() {
        return ctx.getContext();
      }
  
      async function callback() {
        const ctx1 = await getCtx(1);
        const ctx2 = await getCtx(2);
        return {ctx1, ctx2};
      }
  
      async function promiseFor(id) {
        const {c1, c2} = await ctx.letContext(id, () => callback());
        console.log(c1)
        console.log(c2)
        expect(c1).to.not.equal(null);
        expect(c2).to.not.equal(null);
      }
      await promiseFor(1); // eslint-disable-line
    });
  })
});
