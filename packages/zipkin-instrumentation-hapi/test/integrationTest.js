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

  function middlewareFunction({tracer}) {
    return (server) => {
      server.route({
        method: 'GET',
        path: '/weather/wuhan',
        config: {
          handler: (request, h) => {
            tracer.recordBinary('city', 'wuhan');
            return h.response(request.headers);
          }
        }
      });
      server.route({
        method: 'GET',
        path: '/weather/beijing',
        config: {
          handler: (request, h) => {
            tracer.recordBinary('city', 'beijing');
            return h.response(request.headers);
          }
        }
      });
      server.route({
        method: 'GET',
        path: '/weather/peking',
        handler: (request, h) => {
          tracer.recordBinary('city', 'peking');
          return h.redirect('/weather/beijing');
        }
      });
      server.route({
        method: 'GET',
        path: '/weather/shenzhen',
        handler: (request, h) => new Promise(done => setTimeout(() => {
          tracer.letId(request._trace_id, () => {
            tracer.recordBinary('city', 'shenzhen');
            done();
          });
        }, 10)).then(() => h.response())
      });
      server.route({
        method: 'GET',
        path: '/weather/siping',
        config: {
          handler: (request, h) => new Promise(done => setTimeout(() => done(h.response()), 4))
        }
      });
      server.route({
        method: 'GET',
        path: '/weather/securedTown',
        config: {
          handler: (request, h) => {
            tracer.recordBinary('city', 'securedTown');
            return h.response().code(401);
          }
        }
      });
      server.route({
        method: 'GET',
        path: '/weather/bagCity',
        config: {
          handler: () => {
            tracer.recordBinary('city', 'bagCity');
            throw new Error('service is dead');
          }
        }
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
