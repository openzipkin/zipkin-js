const express = require('express');

function middleware() {
  const api = express();
  api.get('/weather/wuhan', (req, res) => {
    res.status(200).json(req.headers);
  });
  api.get('/weather/beijing', (req, res) => {
    res.status(200).json(req.headers);
  });
  api.get('/weather/securedTown', (req, res) => {
    res.status(401).json(req.headers);
  });
  api.get('/weather/bagCity', (req, res, next) => {
    next(new Error('service is dead'));
  });
  return api;
}
module.exports = middleware;
