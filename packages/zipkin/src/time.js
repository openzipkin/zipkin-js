// Returns the current time in epoch microseconds
// if startTimestamp and startTick are present, process.hrtime is used
// See https://nodejs.org/api/process.html#process_process_hrtime_time
module.exports.now = function now(startTimestamp, startTick) {
  if (startTimestamp && startTick && process && process.hrtime) {
    const hrtime = process.hrtime(startTick);
    const elapsedMicros = Math.floor(hrtime[0] * 1000000 + hrtime[1] / 1000);
    return startTimestamp + elapsedMicros;
  } else {
    return new Date().getTime() * 1000;
  }
};
