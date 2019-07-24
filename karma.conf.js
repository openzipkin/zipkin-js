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
      // This allows http client tests that execute in the browser to be able to hit
      // endpoint needed for functional testing such as status code parsing.
      //
      // Technically, this adds extra endpoints to the karma server (which serves the
      // unit tests themselves). Http client tests call relative paths to access these
      // endpoints. This is needed because unlike normal node.js tests, we can't start
      // a server listener for test endpoints inside the web browser.
      'middleware:custom': ['factory', testMiddleware]
    },
      'karma-mocha',
      'karma-browserify',
      'karma-chai',
      'karma-source-map-support',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-mocha-reporter',
    ],
    frameworks: ['mocha', 'browserify', 'chai', 'source-map-support'],
    preprocessors: {
      'test/**/*.js': ['browserify']
    },
    browserify: {
      debug: true,
    },
    files: ['test/**/*.js'],
    // unless you use the mocha reporter, you won't see test failure details.
    reporters: ['mocha'],
    mochaReporter: {
      // unless showDiff, you won't see which properties were unexpected
      showDiff: true,
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
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
