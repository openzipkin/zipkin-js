import express from 'express';

export const mockServer = () => new Promise(resolve => {
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
  const apiServer = api.listen(0, () => {
    resolve(apiServer);
  });
});
