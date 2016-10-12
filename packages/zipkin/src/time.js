const hrTimeSupport = typeof process !== 'undefined' && process.hrtime;

// since hrtime isn't available, we can ignore the input parameters
function nowLegacy() {
  return Date.now() * 1000;
}

function nowHrTime(startTimestamp, startTick) {
  if (startTimestamp && startTick) {
    const hrtime = process.hrtime(startTick);
    const elapsedMicros = Math.floor(hrtime[0] * 1000000 + hrtime[1] / 1000);
    return startTimestamp + elapsedMicros;
  } else {
    return Date.now() * 1000;
  }
}

// Returns the current time in epoch microseconds
// if startTimestamp and startTick are present, process.hrtime is used
// See https://nodejs.org/api/process.html#process_process_hrtime_time
module.exports.now = hrTimeSupport ? nowHrTime : nowLegacy;
module.exports.hrtime = hrTimeSupport
  ? () => process.hrtime()
  : () => undefined;
