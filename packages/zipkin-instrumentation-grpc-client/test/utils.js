/* eslint-disable new-cap */
import grpc from 'grpc';
import * as protoLoader from '@grpc/proto-loader';

// constants
const PROTO_PATH = `${__dirname}/protos/weather.proto`;
const PROTO_OPTIONS = {
  keepCase: true, enums: String, defaults: true, oneofs: true
};

const definition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const {weather} = grpc.loadPackageDefinition(definition);

function getTemperature(call, callback) {
  const metadata = call.metadata.getMap();
  switch (call.request.location) {
    case 'Las Vegas': return callback(new Error('test'));
    case 'Tahoe': return callback(null, {temperature: '26', metadata});
    default: return callback(null, {temperature: '50', metadata});
  }
}

function getLocations(call, callback) {
  const metadata = call.metadata.getMap();
  return callback(null, {locations: ['Germany', 'France'], metadata});
}

const mockServer = () => {
  const server = new grpc.Server();
  server.addService(weather.WeatherService.service, {
    // here we map real methods to the proto service stubs
    getLocations,
    getTemperature
  });
  server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
  return server;
};

export {mockServer, weather};
