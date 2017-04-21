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

  it('should get the address by hostname', done => {
    InetAddress.getAddressByName('localhost', addr => {
      expect(addr).to.be.an.instanceof(InetAddress);
      done();
    });
  });

  it('should get the address by IPv4 address', done => {
    InetAddress.getAddressByName('80.91.37.133', addr => {
      expect(addr.toInt()).to.equal(1348150661);
      done();
    });
  });

  it('should get the address by InetAddress instance', done => {
    const inetAddr = new InetAddress('80.91.37.133');
    InetAddress.getAddressByName(inetAddr, addr => {
      expect(addr.toInt()).to.equal(1348150661);
      done();
    });
  });
});
