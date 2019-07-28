const Hapi = require('hapi');
const middleware = require('../src/hapiMiddleware');

const serverFixture = require('../../../test/httpServerTestFixture');

describe('hapi instrumentation - integration test', () => {
  function serverFunction(configureRoutes, onListen) {
    const server = new Hapi.Server({address: 'localhost', port: 0});
    configureRoutes(server).then(() => server.start()).then(() => onListen(server.info.port));
    return ({close: () => server.stop()});
  }

  function httpsServerFunction(tls, configureRoutes, onListen) {
    const server = new Hapi.Server({address: 'localhost', port: 0, tls});
    configureRoutes(server).then(() => server.start()).then(() => onListen(server.info.port));
    return ({close: () => server.stop()});
  }

  function middlewareFunction({tracer, routes}) {
    return (server) => {
      routes.forEach((route) => {
        server.route({
          method: 'GET',
          path: route.path,
          config: {
            handler: (request, h) => route.handle(request, ({redirect, body, code}) => {
              if (redirect) {
                return h.redirect(redirect);
              } else if (body) {
                return h.response(JSON.stringify(body));
              } else if (code) {
                return h.response().code(code);
              }
              return h.response();
            })
          }
        });
      });

      server.route({
        method: 'GET',
        path: '/abandon',
        config: {
          handler: (request, h) => {
            request.raw.res.setHeader('content-type', 'text/plain');
            request.raw.res.end('manual'); // implicitly makes request.raw.res.headersSent true
            return h.abandon;
          }
        }
      });
      return server.register({plugin: middleware, options: {tracer}});
    };
  }

  serverFixture.setupAllHttpServerTests({
    middlewareFunction,
    serverFunction,
    httpsServerFunction
  });

  it('should handle abandoned requests', () => {
    // const path = '/abandon';
    // https://github.com/hapijs/hapi/blob/cb2355c07d969924568b1fd25471e2761b6e9abe/API.md#h.abandon
    // return fetch(`${baseURL}${path}`)
    //   .then(() => tracer.expectNextSpanToEqual(TODO: handle this));
  });
});
