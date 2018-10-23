import { randomTraceId } from 'zipkin';
import { expect } from 'chai';

describe('RandomTraceId', () => {
  it('should return string', () => {
    const rand = randomTraceId();

    expect(rand).to.be.a('string');
  });
});
