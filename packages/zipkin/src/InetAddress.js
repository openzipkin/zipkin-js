const dns = require('dns');
const net = require('net');
const networkAddress = require('network-address');

class InetAddress {
  constructor(addr) {
    this.addr = addr;
  }
  toInt() {
    // e.g. 10.57.50.83
    // should become
    // 171520595
    const parts = this.addr.split('.');

    // The jshint tool always complains about using bitwise operators,
    // but in this case it's actually intentional, so we disable the warning:
    // jshint bitwise: false
    return parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3];
  }
  toString() {
    return `InetAddress(${this.addr})`;
  }
}

InetAddress.getLocalAddress = function getLocalAddress() {
  return new InetAddress(networkAddress.ipv4());
};

InetAddress.getAddressByName = function getAddressByName(host, callback) {
  if (!host) {
    callback(0);
  } else if (host instanceof InetAddress) {
    callback(host);
  } else if (net.isIPv4(host)) {
    callback(new InetAddress(host));
  } else {
    // only IPv4 addresses are supported by `InetAddress`,
    // so restrict the lookup call to `family: 4` only
    dns.lookup(host, {family: 4}, (err, addr) => {
      if (err !== null) {
        callback(0);
        return;
      }
      callback(new InetAddress(addr));
    });
  }
};

module.exports = InetAddress;
