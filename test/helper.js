require('@babel/register')();
const chai = require('chai');

chai.config.includeStack = true;
global.expect = chai.expect;

// Otherwise assertion failures in async tests are wrapped, which prevents mocha from
// being able to interpret them (such as displaying a diff).
process.on('unhandledRejection', (err) => {
  throw err;
});

if (process.env.TEST_SUITE === 'browser') {
  /* eslint-disable no-console */
  console.log('WARN: Skipping nodejs tests because TEST_SUITE is \'browser\'.');
  /* eslint-enable no-console */
  process.exit(0);
}
