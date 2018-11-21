import { expect } from 'chai';
import { InetAddress } from 'zipkin';

describe('InetAddress', () => {
  it('should have correct type', () => {
    const addr: InetAddress = new InetAddress('80.91.37.133');

    expect(addr.ipv4).to.be.a('function');
  });
});
