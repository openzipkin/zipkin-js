import uuid from 'uuid/v4';
import CLSContext from 'zipkin-context-cls';
import {Tracer} from 'zipkin';
import sinon from 'sinon';
import grpc from 'grpc';
import grpcIntrumentation from '../src/grpcClientInterceptor';
import {mockServer, getClient} from './utils';

describe('gRPC client instrumentation (integration test)', () => {
  const localServiceName = 'weather-client';
  const remoteServiceName = 'weater-service';

  let server;
  before(() => {
    server = mockServer();
    server.start();
  });

  after(() => {
    server.forceShutdown();
  });

  let record;
  let recorder;
  let ctxImpl;
  let tracer;

  beforeEach(() => {
    record = sinon.spy();
    recorder = {record};
    ctxImpl = new CLSContext(`zipkin-test-${uuid()}`);
    tracer = new Tracer({recorder, ctxImpl, localServiceName});
  });

  it('should record successful request', done => {
    tracer.scoped(() => {
      const client = getClient();
      const interceptor = grpcIntrumentation(grpc, {tracer, remoteServiceName});
      client.getTemperature({location: 'Tahoe'}, {interceptors: [interceptor]}, (err) => {
        if (err) {
          return done(err);
        }

        const annotations = record.args.map(args => args[0]);
        const traceId = annotations[0].traceId.traceId;

        annotations.forEach(annot => {
          expect(annot.traceId.traceId).to.equal(traceId).and.to.have.lengthOf(16);
        });

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
        expect(annotations[0].annotation.serviceName).to.equal(localServiceName);

        expect(annotations[1].annotation.annotationType).to.equal('Rpc');
        expect(annotations[1].annotation.name).to.equal('/weather.WeatherService/GetTemperature');

        expect(annotations[2].annotation.annotationType).to.equal('ClientSend');

        expect(annotations[3].annotation.annotationType).to.equal('ServerAddr');

        expect(annotations[4].annotation.annotationType).to.equal('ClientRecv');
        return done();
      });
    });
  });

  it('should record successful request', done => {
    tracer.scoped(() => {
      const client = getClient();
      const interceptor = grpcIntrumentation(grpc, {tracer, remoteServiceName});
      client.getTemperature({location: 'Las Vegas'}, {interceptors: [interceptor]}, () => {
        const annotations = record.args.map(args => args[0]);
        const traceId = annotations[0].traceId.traceId;

        annotations.forEach(annot => {
          expect(annot.traceId.traceId).to.equal(traceId).and.to.have.lengthOf(16);
        });

        expect(annotations[0].annotation.annotationType).to.equal('ServiceName');
        expect(annotations[0].annotation.serviceName).to.equal(localServiceName);

        expect(annotations[1].annotation.annotationType).to.equal('Rpc');
        expect(annotations[1].annotation.name).to.equal('/weather.WeatherService/GetTemperature');

        expect(annotations[2].annotation.annotationType).to.equal('ClientSend');

        expect(annotations[3].annotation.annotationType).to.equal('ServerAddr');

        expect(annotations[4].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[4].annotation.key).to.equal('grpc.status_code');
        expect(annotations[4].annotation.value).to.equal('2');

        expect(annotations[5].annotation.annotationType).to.equal('BinaryAnnotation');
        expect(annotations[5].annotation.key).to.equal('error');
        expect(annotations[5].annotation.value).to.equal('2');

        expect(annotations[6].annotation.annotationType).to.equal('ClientRecv');
        return done();
      });
    });
  });

  it('should send "x-b3-flags" header', done => {
    tracer.scoped(() => {
      const client = getClient();

      // enables debug
      tracer.setId(tracer.createRootId(undefined, true));

      const interceptor = grpcIntrumentation(grpc, {tracer, remoteServiceName});
      client.getTemperature({location: 'Tahoe'}, {interceptors: [interceptor]}, (err, res) => {
        if (err) {
          return done(err);
        }
        const {metadata} = res;
        // eslint-disable-next-line no-unused-expressions
        expect(metadata['x-b3-flags']).to.equal('1');
        return done();
      });
    });
  });
});
