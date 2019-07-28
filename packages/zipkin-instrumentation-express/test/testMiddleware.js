function addTestRoutes(app, tracer) {
  app.get('/weather/wuhan', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'wuhan');
    res.status(200).json(req.headers);
  });
  app.get('/weather/beijing', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'beijing');
    res.status(200).json(req.headers);
  });
  app.get('/weather/peking', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'peking');
    res.redirect('/weather/beijing');
  });
  app.get('/weather/shenzhen', (req, res) => new Promise(done => setTimeout(() => {
    tracer.letId(req._trace_id, () => {
      tracer.recordBinary('city', 'shenzhen');
      done();
    });
  }, 10)).then(() => res.send(200)));
  app.get('/weather/siping', (req, res) => new Promise(() => setTimeout(() => res.send(200), 4)));
  app.get('/weather/securedTown', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'securedTown');
    res.send(401);
  });
  app.get('/weather/bagCity', () => {
    if (tracer) tracer.recordBinary('city', 'bagCity');
    throw new Error('service is dead');
  });
  return app;
}
module.exports = addTestRoutes;
