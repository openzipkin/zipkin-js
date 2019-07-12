# zipkin-instrumentation-grpc-client

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-grpc-client.svg)

[GRPC client](https://grpc.io/docs/tutorials/basic/node.html) interceptor for Zipkin.

## Usage
The library is a GRPC interceptor and can be used as:

```javascript
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

const {Tracer, ExplicitContext, ConsoleRecorder} = require('zipkin');
const grpcInstrumentation = require('zipkin-instrumentation-grpc-client');

const PROTO_PATH = __dirname + '/protos/weather.proto';
const PROTO_OPTIONS = { keepCase: true, enums: String, defaults: true, oneofs: true };

// setup zipkin tracer
const ctxImpl = new ExplicitContext();
const recorder = new ConsoleRecorder();
const localServiceName = 'service-a'; // name of this application
const tracer = new Tracer({ctxImpl, recorder, localServiceName});

// setup grpc client
const definition = protoLoader.loadSync(PROTO_PATH, PROTO_OPTIONS);
const weather = grpc.loadPackageDefinition(definition).weather;
const client = new weather.WeatherService('localhost:50051', grpc.credentials.createInsecure());

//setup interceptor
const remoteServiceName = 'weather-service';
const interceptor = grpcInstrumentation(grpc, {tracer, remoteServiceName});

client.getTemperature({ location: 'Tahoe'}, { interceptors: [interceptor] }, (error, response) => {
    console.info(`temprature in Tahoe is: ${response.temperature} `);
});
```

The important snippet is:

```javascript
const interceptor = grpcInstrumentation(grpc, {tracer, remoteServiceName});

client.getTemperature({ location: 'Tahoe'}, { interceptors: [interceptor] }, (error, response) => {
    console.info(`temprature in Tahoe is: ${response.temperature} `);
});

``` 

