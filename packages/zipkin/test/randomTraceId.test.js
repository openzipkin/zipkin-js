const randomTraceId = require('../src/tracer/randomTraceId');

describe('random trace id', () => {
  it('should have fixed length of 16 characters', () => {
    for (let i = 0; i < 100; i++) {
      const rand = randomTraceId();
      expect(rand.length).to.equal(16);
    }
  });
});
