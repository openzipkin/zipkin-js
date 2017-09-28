const networkAddress = require('network-address');

module.exports = function getLocalAddress() {
  return networkAddress.ipv4();
};
