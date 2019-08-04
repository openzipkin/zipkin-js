const Koa = require('koa');
const koaRoute = require('koa-route');
const https = require('https');
const middleware = require('../src/koaMiddleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('koa instrumentation - integration test', () => {
  function middlewareFunction({tracer, routes}) {
    const app = new Koa();
    app.use(middleware({tracer}));
    routes.forEach((route) => {
      app.use((ctx, next) => next().catch(() => ctx.status = 500));
      app.use(koaRoute.get(route.path, (ctx) => {
        const res = route.handle(ctx.request, ({redirect, body, code}) => {
          if (redirect) {
            ctx.redirect(redirect);
          } else if (body) {
            ctx.body = body;
          } else if (code) {
            ctx.status = code;
          } else {
            ctx.status = 200;
          }
        });
        return res;
      }));
    });
    return app;
  }

  function httpsServerFunction(options, app, onListen) {
    const httpsServer = https.createServer(options, app.callback())
      .listen(0, () => onListen(httpsServer.address().port));
    return httpsServer;
  }

  serverFixture.setupAllHttpServerTests({
    middlewareFunction,
    httpsServerFunction,
    routeBasedSpanName: true
  });
});
