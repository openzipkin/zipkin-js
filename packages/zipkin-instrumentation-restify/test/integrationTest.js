const restify = require('restify');
const middleware = require('../src/restifyMiddleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('restify instrumentation - integration test', () => {
  function middlewareFunction({tracer}) {
    // Restify uses async hooks. Until there is a CLS hooked implementation here, we need to be
    // explicit with trace IDs. See https://github.com/openzipkin/zipkin-js/issues/88
    function addTag(req, key, value) {
      tracer.letId(req._trace_id, () => tracer.recordBinary(key, value));
    }

    const app = restify.createServer({handleUncaughtExceptions: true});
    app.use(middleware({tracer}));
    app.get('/weather/wuhan', (req, res, next) => {
      addTag(req, 'city', 'wuhan');
      res.send(req.headers);
      return next();
    });
    app.get('/weather/beijing', (req, res, next) => {
      addTag(req, 'city', 'beijing');
      res.send(req.headers);
      return next();
    });
    app.get('/weather/peking', (req, res, next) => {
      addTag(req, 'city', 'peking');
      res.redirect('/weather/peking', next);
    });
    app.get('/weather/shenzhen', (req, res) => new Promise(done => setTimeout(() => {
      tracer.letId(req._trace_id, () => {
        tracer.recordBinary('city', 'shenzhen');
        done();
      });
    }, 10)).then(() => res.send()));
    app.get('/weather/siping',
      (req, res) => new Promise(done => setTimeout(() => done(res.send()), 4)));
    app.get('/weather/securedTown', (req, res, next) => {
      addTag(req, 'city', 'securedTown');
      res.send(401);
      return next();
    });
    app.get('/weather/bagCity', (req) => {
      addTag(req, 'city', 'bagCity');
      throw new Error('service is dead');
    });
    return app;
  }

  serverFixture.setupBasicHttpServerTests({middlewareFunction});
});
