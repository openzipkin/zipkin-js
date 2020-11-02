// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

const expressMiddleware = require('./expressMiddleware');
const wrapExpressHttpProxy = require('./wrapExpressHttpProxy');

module.exports = {
  expressMiddleware,
  wrapExpressHttpProxy
};
