require('@babel/register')({
  extensions: ['.js', '.ts'],
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript',
  ],
});
const chai = require('chai');
chai.config.includeStack = true;
global.expect = chai.expect;
