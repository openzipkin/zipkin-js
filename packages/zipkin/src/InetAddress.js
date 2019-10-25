class InetAddress {
  constructor(addr) {
    this.addr = addr;
  }

  // returns undefined if this isn't an IPv4 string
  ipv4() {
    // coercing to int forces validation here
    const ipv4Int = this.toInt();
    if (ipv4Int && ipv4Int !== 0) {
      return this.addr;
    }
    return undefined;
  }

  toInt() {
    // e.g. 10.57.50.83
    // should become
    // 171520595
    const parts = this.addr.split('.');

    // The eslint tool always complains about using bitwise operators,
    // but in this case it's actually intentional, so we disable the warning:
    /* eslint-disable-next-line */
    return parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3];
  }

  toString() {
    return `InetAddress(${this.addr})`;
  }
}

// In non-node environments we fallback to 127.0.0.1
function getLocalAddress() {
  const isNode = typeof process === 'object' && typeof process.on === 'function';
  if (!isNode) {
    return new InetAddress('127.0.0.1');
  }

  // eslint-disable-next-line global-require
  const networkAddress = require('./network');
  return new InetAddress(networkAddress.ipv4());
}

// Cache this value at import time so as to avoid network interface
// lookup on every call
const cachedLocalAddress = getLocalAddress();
InetAddress.getLocalAddress = () => cachedLocalAddress;

module.exports = InetAddress;
