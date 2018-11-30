/* eslint-disable new-cap */
import {Tracer, ConsoleRecorder} from 'zipkin';
import CLSContext from 'zipkin-context-cls';
import uuid from 'uuid/v4';
import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

// constants
const PROTO_PATH = `${__dirname}/protos/weather.proto`;
const PROTO_OPTIONS = {keepCase: true, enums: String, defaults: true, oneofs: true};

const definition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const weather = grpc.loadPackageDefinition(definition).weather;

function getTemperature(call, callback) {
  const metadata = call.metadata.getMap();
  switch (call.request.location) {
    case 'Las Vegas': return callback(new Error('test'));
    case 'Tahoe': return callback(null, {temperature: '26', metadata});
    default: return callback(null, {temperature: '50', metadata});
  }
}

/**
 * Tracer factory
 * @return {zipkin.Tracer}
 */
const makeTracer = () => new Tracer({
  ctxImpl: new CLSContext(`zipkin-test-${uuid()}`),
  traceId128Bit: true,
  recorder: new ConsoleRecorder(() => {}),
});

const tracer = makeTracer();
const makeTraceId = () => tracer.createRootId();

const mockServer = () => {
  const server = new grpc.Server();
  server.addService(weather.WeatherService.service, {
    // here we map real methods to the proto service stubs
    getTemperature
  });
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  return server;
};

const getClient = () =>
  new weather.WeatherService('localhost:50051', grpc.credentials.createInsecure());

export {
  makeTracer,
  makeTraceId,
  mockServer,
  getClient
};
