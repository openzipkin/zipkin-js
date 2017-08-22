const grpc = require('grpc');

const zipkinBaseUrl = 'http://faked:64800';

const CLSContext = require('zipkin-context-cls');

const {Tracer, BatchRecorder, ConsoleRecorder} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');

const recorder = new BatchRecorder({
  logger: new HttpLogger({
    endpoint: `${zipkinBaseUrl}/api/v1/spans`
  })
});

const ctxImpl = new CLSContext('zipkin');

const tracer = new Tracer({ctxImpl, recorder});

const ZIPKIN_GRPC_INTCP = new (require('../src/ZipkinGrpcInterceptor'))(tracer);

const chai = require('chai');
const {assert, expect} = chai;
const should = chai.should();

describe('Zipkin GRPC interceptor basic test', () => {

  it("No 'grpc.Metadata' passed in, should return a 'grpc.Metadata' instance with necessary X-B3 fields.", function(done) {

    const metadata = ZIPKIN_GRPC_INTCP.beforeClientDoGrpcCall({});

    expect(metadata).to.be.an.instanceof(grpc.Metadata);

    expect(!metadata.get('x-b3-traceid')).to.be.false;
    expect(!metadata.get('x-b3-parentspanid')).to.be.false;
    expect(!metadata.get('x-b3-spanid')).to.be.false;
    expect(!metadata.get('x-b3-sampled')).to.be.false;

    done()

  });

  it("Pass in 'grpc.Metadata', should return previous values with necessary X-B3 fields.", function(done) {

    const metadata = new grpc.Metadata();

    metadata.add('deliberateKey', 'deliberateVal');

    const newMetadata = ZIPKIN_GRPC_INTCP.beforeClientDoGrpcCall({grpcMetadata: metadata});

    expect(newMetadata).to.be.an.instanceof(grpc.Metadata);

    expect(newMetadata.get('deliberatekey')[0]).to.equal('deliberateVal');

    done();

  });

});
