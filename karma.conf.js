const path = require('path');
const testMiddleware = require('./test/middleware');

module.exports = function(config) {
  if (process.env.TEST_SUITE === 'nodejs') {
    /* eslint-disable no-console */
    console.log('WARN: Skipping browser tests because TEST_SUITE is \'nodejs\'.');
    /* eslint-enable no-console */
    process.exit(0);
  }

  config.set({
    // resolve to the package not the location of this file
    basePath: path.resolve('.'),
    failOnEmptyTestSuite: true,
    middleware: ['custom'],
    plugins: [
    {
      'middleware:custom': ['factory', testMiddleware]
    },
      'karma-mocha',
      'karma-browserify',
      'karma-chai',
      'karma-source-map-support',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
    ],
    frameworks: ['mocha', 'browserify', 'chai', 'source-map-support'],
    preprocessors: {
      'test/**/*.js': ['browserify']
    },
    browserify: {
      debug: true,
    },
    files: ['test/**/*.js'],
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_DEBUG,
    // see https://github.com/karma-runner/karma-firefox-launcher/issues/76
    customLaunchers: {
      FirefoxHeadless: {
        base: 'Firefox',
        flags: ['-headless'],
      },
    },
    browsers: ['ChromeHeadless', 'FirefoxHeadless'],
    autoWatch: false,
    concurrency: Infinity
  });
};
