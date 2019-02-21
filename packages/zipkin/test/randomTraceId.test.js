const {randomTraceId, randomTraceId128bit} = require('../src/tracer/randomTraceId');

describe('trace id generation', () => {
  describe('#randomTraceId', () => {
    it('should have fixed length of 16 characters', () => {
      for (let i = 0; i < 100; i++) {
        const rand = randomTraceId();
        expect(rand.length).to.equal(16);
      }
    });
  });
  describe('#randomTraceId128bit', () => {
    it('should have fixed length of 32 characters', () => {
      for (let i = 0; i < 100; i++) {
        const rand = randomTraceId128bit();
        expect(rand.length).to.equal(32);
      }
    });
  });
});
