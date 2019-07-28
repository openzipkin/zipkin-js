const restify = require('restify');
const middleware = require('../src/restifyMiddleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('restify instrumentation - integration test', () => {
  // Restify uses async hooks. Until there is a CLS hooked implementation here, we need to be
  // explicit with trace IDs. See https://github.com/openzipkin/zipkin-js/issues/88
  function addTag(tracer, req, key, value) {
    tracer.letId(req._trace_id, () => tracer.recordBinary(key, value));
  }

  function middlewareFunction({tracer, routes}) {
    const app = restify.createServer({handleUncaughtExceptions: true});
    app.use(middleware({tracer}));
    routes.forEach((route) => {
      app.get(route.path, (req, res, next) => route.handle(req, ({redirect, body, code}) => {
        if (redirect) {
          return res.redirect('/weather/peking', next);
        } else if (body) {
          return res.send(body);
        } else if (code) {
          return res.send(code);
        }
        return res.send();
      }));
    });
    return app;
  }

  serverFixture.setupBasicHttpServerTests({middlewareFunction, addTag});
});
