const CLSContext = require('../');

const namespace = 'mynamespace';

function CLSContextPerAsync(supportAsync) {
  it('should start with context null', () => {
    const ctx = new CLSContext(namespace, supportAsync);
    expect(ctx.getContext()).to.equal(null);
  });

  it('should set an inner context', () => {
    const ctx = new CLSContext(namespace, supportAsync);
    ctx.letContext('tres-leches', () => {
      expect(ctx.getContext()).to.equal('tres-leches');
    });
    ctx.setContext(null);
  });

  it('should set an inner context with setContext', () => {
    const ctx = new CLSContext(namespace, supportAsync);
    ctx.scoped(() => {
      ctx.setContext('tiramisú');
      expect(ctx.getContext()).to.equal('tiramisú');
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('should return the inner value', () => {
    const ctx = new CLSContext(namespace, supportAsync);
    const returnValue = ctx.letContext('cheesecake', () => 123);
    expect(returnValue).to.equal(123);
  });

  it('should be reset after the callback', () => {
    const ctx = new CLSContext(namespace, supportAsync);
    ctx.letContext('combinado', () => {
      // do nothing
    });
    expect(ctx.getContext()).to.equal(null);
  });

  it('should reset after error in callback', () => {
    const ctx = new CLSContext(namespace, supportAsync);

    let error;
    try {
      ctx.letContext('buy-red-velvet', () => {
        throw new Error('no red velvet. try our cake');
      });
    } catch (err) {
      error = err; // error wasn't swallowed
    }

    // sanity check
    expect(error.message).to.eql('no red velvet. try our cake');

    // context wasn't leaked
    expect(ctx.getContext()).to.equal(null);
  });

  it('supports nested contexts', () => {
    const ctx = new CLSContext(namespace, supportAsync);
    const finalReturnValue = ctx.letContext('lemon-pie', () => {
      expect(ctx.getContext()).to.equal('lemon-pie');
      const innerReturnValue = ctx.letContext('pannacotta', () => {
        expect(ctx.getContext()).to.equal('pannacotta');
        return 1;
      });
      expect(ctx.getContext()).to.equal('lemon-pie');
      return innerReturnValue + 2;
    });
    expect(ctx.getContext()).to.equal(null);
    expect(finalReturnValue).to.equal(3);
  });

  it('supports CLS contexts (setTimeout etc)', (done) => {
    const ctx = new CLSContext(namespace, supportAsync);
    function callback() {
      expect(ctx.getContext()).to.equal('brownie');
      ctx.setContext(null);
      done();
    }
    ctx.letContext('brownie', () => {
      setTimeout(callback, 10);
    });
  });
}

describe('CLSContext', () => {
  describe('without async-await support', () => {
    CLSContextPerAsync(false);
  });

  describe('with async-await support', () => {
    CLSContextPerAsync(true);

    it('supports async-await contexts', async() => {
      const ctx = new CLSContext(namespace, true);
      ctx.setContext('arroz-con-leche');

      async function stall(stallTime) {
        await new Promise(resolve => setTimeout(resolve, stallTime));
      }

      async function getCtx() {
        const durationInMs = Math.random() + 0.1;
        await stall(durationInMs * 500);
        return ctx.getContext();
      }

      async function callback() {
        const obtainedContext = await getCtx();
        return obtainedContext;
      }

      async function fn() {
        const ctx1 = await ctx.letContext('budin', () => callback());
        const ctx2 = await ctx.letContext('torta-helada', () => callback());
        expect(ctx1).to.equal('budin');
        expect(ctx2).to.equal('torta-helada');
      }

      await fn(); // eslint-disable-line
    });
  });
});
