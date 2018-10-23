const os = require('os');

function pickInterface(interfaces, family) {
  /*eslint-disable */
  for (const i in interfaces) {
    /*eslint-enable */
    for (let j = interfaces[i].length - 1; j >= 0; j--) {
      const face = interfaces[i][j];
      const reachable = family === 'IPv4' || face.scopeid === 0;
      if (!face.internal && face.family === family && reachable) return face.address;
    }
  }
  return family === 'IPv4' ? '127.0.0.1' : '::1';
}

function ipv4() {
  const interfaces = os.networkInterfaces();
  return pickInterface(interfaces, 'IPv4');
}

module.exports = {
  ipv4
};
