// === Generate a random 64-bit number in fixed-length hex format
export function randomTraceId() {
  const digits = '0123456789abcdef';
  let n = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 16);
    n += digits[rand];
  }
  return n;
}

export function randomTraceId128bit() {
  return randomTraceId() + randomTraceId();
}
