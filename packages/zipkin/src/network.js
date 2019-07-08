const os = require('os');


function pickInterface(interfaces, family) {
  /* eslint-disable */
  for (const i in interfaces) {
    /* eslint-enable */
    for (let j = interfaces[i].length - 1; j >= 0; j -= 1) {
      const face = interfaces[i][j];
      const reachable = family === 'IPv4' || face.scopeid === 0;
      if (!face.internal && face.family === family && reachable) return face.address;
    }
  }
  return family === 'IPv4' ? '127.0.0.1' : '::1';
}

function reduceInterfaces(interfaces, iface) {
  const ifaces = {};
  /*eslint-disable */
  for (const i in interfaces) {
    /* eslint-enable */
    if (i === iface) ifaces[i] = interfaces[i];
  }
  return ifaces;
}

function ipv4(iface) {
  let interfaces = os.networkInterfaces();
  if (iface) interfaces = reduceInterfaces(interfaces, iface);
  return pickInterface(interfaces, 'IPv4');
}

function ipv6(iface) {
  let interfaces = os.networkInterfaces();
  if (iface) interfaces = reduceInterfaces(interfaces, iface);
  return pickInterface(interfaces, 'IPv6');
}

ipv4.ipv4 = ipv4;
ipv4.ipv6 = ipv6;

module.exports = ipv4;
