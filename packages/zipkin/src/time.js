// Returns the current time in epoch microseconds
module.exports.now = function now() {
  return new Date().getTime() * 1000;
};
