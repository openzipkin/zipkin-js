import { expect } from 'chai';
import { randomTraceId, randomTraceId128bit } from 'zipkin';

describe('trace id generation', () => {
  describe('#randomTraceId', () => {
    it('should return string', () => {
      const rand = randomTraceId();

      expect(rand).to.be.a('string');
    });
  });

  describe('#randomTraceId128bit', () => {
    it('should return string', () => {
      const rand = randomTraceId128bit();

      expect(rand).to.be.a('string');
    });
  });
});
