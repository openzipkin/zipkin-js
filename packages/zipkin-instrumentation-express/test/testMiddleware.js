// Until there is a CLS hooked implementation here, we need to be explicit with trace IDs.
// See https://github.com/openzipkin/zipkin-js/issues/88
function step(tracer, req, num) {
  return new Promise((done) => {
    setTimeout(() => {
      tracer.letId(req._trace_id, () => {
        tracer.recordBinary('step', num.toString());
        done();
      });
    }, 10);
  });
}

function addTestRoutes(app, tracer) {
  app.get('/weather/wuhan', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'wuhan');
    res.status(200).json(req.headers);
  });
  app.get('/weather/beijing', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'beijing');
    res.status(200).json(req.headers);
  });
  app.get('/weather/securedTown', (req, res) => {
    if (tracer) tracer.recordBinary('city', 'securedTown');
    res.status(401).json(req.headers);
  });
  app.get('/weather/bagCity', (req, res, next) => {
    if (tracer) tracer.recordBinary('city', 'bagCity');
    next(new Error('service is dead'));
  });
  app.get('/steps', (req, res) => step(tracer, req, 1)
    .then(() => step(tracer, req, 2))
    .then(() => step(tracer, req, 3))
    .then(() => res.status(200).json(req.headers)));
  return app;
}
module.exports = addTestRoutes;
