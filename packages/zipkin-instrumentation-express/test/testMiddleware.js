function step(tracer, num) {
  return new Promise((done) => {
    setTimeout(() => {
      tracer.scoped(() => {
        tracer.recordBinary('step', num.toString());
        done();
      });
    }, 10);
  });
}

function addTestRoutes(app, tracer) {
  app.get('/weather/wuhan', (req, res) => {
    tracer.recordBinary('city', 'wuhan');
    res.status(200).json(req.headers);
  });
  app.get('/weather/beijing', (req, res) => {
    tracer.recordBinary('city', 'beijing');
    res.status(200).json(req.headers);
  });
  app.get('/weather/securedTown', (req, res) => {
    tracer.recordBinary('city', 'securedTown');
    res.status(401).json(req.headers);
  });
  app.get('/weather/bagCity', (req, res, next) => {
    tracer.recordBinary('city', 'bagCity');
    next(new Error('service is dead'));
  });
  app.get('/steps', (req, res) => step(tracer, 1)
    .then(() => step(tracer, 2))
    .then(() => step(tracer, 3))
    .then(() => res.status(200).json(req.headers)));
  return app;
}
module.exports = addTestRoutes;
