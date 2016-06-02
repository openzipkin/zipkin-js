const randomTraceId = require('../src/tracer/randomTraceId');

describe('random trace id', () => {
  it('should never have leading zeroes', () => {
    for (let i = 0; i < 100; i++) {
      const rand = randomTraceId();
      expect(rand.startsWith('0')).to.equal(false);
    }
  });
});
