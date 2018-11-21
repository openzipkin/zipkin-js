import { expect } from 'chai';
import { randomTraceId } from 'zipkin';

describe('RandomTraceId', () => {
  it('should return string', () => {
    const rand = randomTraceId();

    expect(rand).to.be.a('string');
  });
});
