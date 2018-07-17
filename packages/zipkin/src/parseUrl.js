const url = require('url');

function parseRequestUrl(requestUrl) {
  const parsed = url.parse(requestUrl);

  return {
    host: parsed.hostname,
    path: parsed.pathname
  };
}

module.exports = parseRequestUrl;
