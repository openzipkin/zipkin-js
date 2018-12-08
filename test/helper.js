require('@babel/register')();
const chai = require('chai');
chai.config.includeStack = true;
global.expect = chai.expect;

if (process.env.TEST_SUITE === 'browser') {
  /* eslint-disable no-console */
  console.log('WARN: Skipping nodejs tests because TEST_SUITE is \'browser\'.');
  /* eslint-enable no-console */
  process.exit(0);
}
