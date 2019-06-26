import express from 'express';

export const mockServer = () => new Promise(resolve => {
  const api = express();
  api.get('/weather/wuhan', (req, res) => {
    res.status(202).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });
  api.get('/weather/beijing', (req, res) => {
    res.status(202).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });
  api.get('/weather/securedTown', (req, res) => {
    res.status(400).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });
  api.get('/weather/bagCity', (req, res) => {
    res.status(500).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });
  const apiServer = api.listen(0, () => {
    resolve(apiServer);
  });
});
