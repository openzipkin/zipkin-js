// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

const express = require('express');

function middleware() {
  const api = express();
  api.get('/weather/wuhan', (req, res) => {
    res.status(200).json(req.headers);
  });
  api.get('/weather/beijing', (req, res) => {
    res.status(200).json(req.headers);
  });
  api.get('/weather/peking', (req, res) => {
    res.redirect('/weather/beijing');
  });
  api.get('/weather/securedTown', (req, res) => {
    res.send(401);
  });
  api.get('/weather/bagCity', (req, res, next) => {
    next(new Error('service is dead'));
  });
  return api;
}
module.exports = middleware;
