// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

const url = require('url');

function parseRequestUrl(requestUrl) {
  const parsed = url.parse(requestUrl);

  return {
    host: parsed.hostname,
    path: parsed.pathname
  };
}

module.exports = parseRequestUrl;
