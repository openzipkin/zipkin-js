const express = require('express');

function middleware() {
  const api = express();
  api.get('/weather/wuhan', (req, res) => {
    res.status(202).json(req.headers);
  });
  api.get('/weather/beijing', (req, res) => {
    res.status(202).json(req.headers);
  });
  api.get('/weather/securedTown', (req, res) => {
    res.status(400).json(req.headers);
  });
  api.get('/weather/bagCity', (req, res) => {
    res.status(500).json(req.headers);
  });
  return api;
}
module.exports = middleware;
