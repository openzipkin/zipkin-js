module.exports.now = function now() {
  const d = new Date();
  return d.getTime() * 1000 + d.getMilliseconds();
};
