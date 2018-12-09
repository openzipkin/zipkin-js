module.exports = function(config) {
  if (process.env.TEST_SUITE === 'nodejs') {
    /* eslint-disable no-console */
    console.log('WARN: Skipping browser tests because TEST_SUITE is \'nodejs\'.');
    /* eslint-enable no-console */
    process.exit(0);
  }

  config.set({
    plugins: [
      ...config.plugins,
      'karma-browserify',
      'karma-chai',
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
