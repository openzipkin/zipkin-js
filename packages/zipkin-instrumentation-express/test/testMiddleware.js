function addTestRoutes(app, tracer) {
  app.get('/weather/wuhan', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'wuhan');
    res.json(req.headers);
  });
  app.get('/weather/beijing', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'beijing');
    res.json(req.headers);
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
  }, 10)).then(() => res.send()));
  app.get('/weather/siping',
    (req, res) => new Promise(done => setTimeout(() => done(res.send()), 4)));
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
