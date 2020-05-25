const EventEmitter = require('events');
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

  it('supports callbacks on eventEmitter', async() => {
    const eventEmitter = new EventEmitter();
    const ctx = new CLSContext(namespace, supportAsync);
    // if you comment this out the tests will fail
    // Apparently, it is necessary to explicitly register event emitters with context
    ctx._bindEmitter(eventEmitter);
    // eslint-disable-next-line no-unused-vars
    const log = (...args) => console.log(...args);

    function on(name) {
      return new Promise(resolve => eventEmitter.on(name, resolve));
    }

    async function initialCallback() {
      log('initial callback starting', ctx.getContext());
      const concurrentRequestStarted = on('concurrentRequestStarted');
      eventEmitter.emit('initialRequestStarted');
      log('initial callback started', ctx.getContext());
      await concurrentRequestStarted;
      log('initial callback completing', ctx.getContext());
      eventEmitter.emit('initialRequestComplete', ctx.getContext());
    }

    async function concurrentCallback() {
      const initialRequestComplete = on('initialRequestComplete');
      log('concurrent callback starting', ctx.getContext());
      eventEmitter.emit('concurrentRequestStarted');
      log('concurrent callback started', ctx.getContext());
      await initialRequestComplete;
      log('concurrent callback completing', ctx.getContext());
      eventEmitter.emit('concurrentRequestComplete', ctx.getContext());
      log('concurrent callback completed');
    }

    async function executeCallbacks() {
      const initialRequestComplete = on('initialRequestComplete');
      const concurrentRequestComplete = on('concurrentRequestComplete');

      ctx.letContext('budin', initialCallback);
      ctx.letContext('torta-helada', concurrentCallback);

      const ctx1 = await initialRequestComplete;
      log('initial callback', ctx1);
      const ctx2 = await concurrentRequestComplete;
      log('concurrent callback', ctx2);
      expect(ctx1).to.equal('budin');
      expect(ctx2).to.equal('torta-helada');
    }

    await executeCallbacks(); // eslint-disable-line
  });
}

describe('CLSContext', () => {
  describe('without async-await support', () => {
    CLSContextPerAsync(false);
  });

  describe('with async-await support', () => {
    CLSContextPerAsync(true);
  });
});
