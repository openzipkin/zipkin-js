const InetAddress = require('../src/InetAddress');
describe('InetAddress', () => {
  it('should get the local address', () => {
    InetAddress.getLocalAddress();
  });

  it('should convert an IP address to integer representation', () => {
    const addr = new InetAddress('80.91.37.133');
    expect(addr.toInt()).to.equal(1348150661);
  });

  it('should make a string representation', () => {
    const addr = new InetAddress('80.91.37.133');
    expect(addr.toString()).to.equal('InetAddress(80.91.37.133)');
  });
});
