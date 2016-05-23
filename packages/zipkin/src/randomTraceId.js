// === Generate random 64-bit number in hex format
function randomTraceId() {
  const digits = '0123456789abcdef';
  let n = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 16);

    // avoid leading zeroes
    if (rand !== 0 || n.length > 0) {
      n += digits[rand];
    }
  }
  return n;
}

module.exports = randomTraceId;
