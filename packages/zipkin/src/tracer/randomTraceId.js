// === Generate a random 64-bit number in fixed-length hex format
function randomTraceId() {
  const digits = '0123456789abcdef';
  let n = '';
  for (let i = 0; i < 15; i += 1) {
    const rand = Math.floor(Math.random() * 16);
    n += digits[rand];
  }
  const rand = Math.floor(Math.random() * 8);
  n = digits[rand] + n;

  return n;
}

module.exports = randomTraceId;
