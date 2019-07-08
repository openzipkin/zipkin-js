import grpc from 'grpc';
import tracingInterceptor from '../src/grpcClientInterceptor';

import {mockServer, weather} from './utils';

const {ExplicitContext, Tracer} = require('zipkin');
const {
  newSpanRecorder,
  expectB3Headers,
  expectSpan
} = require('../../../test/testFixture');

describe('gRPC client instrumentation (integration test)', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const temperature = '/weather.weatherservice/gettemperature';
  const locations = '/weather.weatherservice/getlocations';

  let server;
  before(() => {
    server = mockServer();
    server.start();
  });

  after(() => server.forceShutdown());

  let spans;
  let tracer;

  beforeEach(() => {
    spans = [];
    tracer = new Tracer({
      localServiceName: serviceName,
      ctxImpl: new ExplicitContext(),
      recorder: newSpanRecorder(spans)
    });
  });

  // TODO: pull into http tests also
  afterEach(() => expect(spans).to.be.empty);

  function popSpan() {
    expect(spans).to.not.be.empty; // eslint-disable-line no-unused-expressions
    return spans.pop();
  }

  function successSpan(name) {
    return ({
      name,
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {serviceName: remoteServiceName}
      // no tags in grpc in success case..
    });
  }

  function getClient(host = 'localhost:50051') {
    const interceptor = tracingInterceptor(grpc, {tracer, remoteServiceName});
    return new weather.WeatherService(
      host,
      grpc.credentials.createInsecure(),
      {interceptors: [interceptor]}
    );
  }

  it('should add headers to requests', done => getClient().getTemperature({location: 'Tahoe'}, (err, res) => {
    if (err) return done(err);

    const {metadata} = res;
    expectB3Headers(popSpan(), metadata);
    return done();
  }));

  // TODO: this test needs to be pulled up also to the other clients
  it('should send "x-b3-flags" header', (done) => {
    // enables debug
    tracer.setId(tracer.createRootId(undefined, true));

    getClient().getTemperature({location: 'Tahoe'}, (err, res) => {
      if (err) return done(err);

      const {metadata} = res;
      expectB3Headers(popSpan(), metadata);
      return done();
    });
  });

  it('should record successful request', done => getClient().getTemperature({location: 'Tahoe'}, (err) => {
    if (err) return done(err);

    expectSpan(popSpan(), successSpan(temperature));
    return done();
  }));

  it('should report error in tags', done => getClient().getTemperature({location: 'Las Vegas'}, (err, res) => {
    if (err) {
      expectSpan(popSpan(), {
        name: temperature,
        kind: 'CLIENT',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'grpc.status_code': '2', // NOTE: in brave this code is text, like UNAVAILABLE
          error: 'test'
        }
      });
      done();
    } else {
      done(new Error(`expected response to error: ${res}`));
    }
  }));

  it('should report error in tags on transport error', done => getClient('localhost:12345').getTemperature({location: 'Las Vegas'}, (err, res) => {
    if (err) {
      expectSpan(popSpan(), {
        name: temperature,
        kind: 'CLIENT',
        localEndpoint: {serviceName},
        remoteEndpoint: {serviceName: remoteServiceName},
        tags: {
          'grpc.status_code': '14', // NOTE: in brave this code is text, like UNAVAILABLE
          error: 'failed to connect to all addresses'
        }
      });
      done();
    } else {
      done(new Error(`expected response to error: ${res}`));
    }
  }));

  it('should handle nested requests', (done) => {
    const client = getClient();

    client.getTemperature({location: 'Tahoe'}, (err) => {
      if (err) {
        done(err);
      } else {
        client.getLocations({temperature: 25}, (err2) => {
          if (err2) done(err2);

          // since these are sequential, we should have an expected order
          expectSpan(popSpan(), successSpan(locations));
          expectSpan(popSpan(), successSpan(temperature));
          done();
        });
      }
    });
  });

  it('should handle parallel requests', () => {
    const client = getClient();

    const getTemperature = new Promise((resolve) => {
      client.getTemperature({location: 'Tahoe'}, resolve);
    });
    const getLocations = new Promise((resolve) => {
      client.getLocations({temperature: 25}, resolve);
    });

    return Promise.all([getTemperature, getLocations]).then(() => {
      // since these are parallel, we have an unexpected order
      const firstSpan = popSpan(); // TODO: move this race condition fix to http
      const firstName = firstSpan.name === temperature ? temperature : locations;
      const secondName = firstName === temperature ? locations : temperature;

      expectSpan(firstSpan, successSpan(firstName));
      expectSpan(popSpan(), successSpan(secondName));
    });
  });
});
