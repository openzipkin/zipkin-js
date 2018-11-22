import {assert} from 'chai';
import nock from 'nock';
import sinon from 'sinon';
import request from 'superagent';
import zipkinPlugin from '../src/superagentPlugin';
import {makeTracer, makeTraceId} from './utils';

describe('SuperAgent Plugin', () => {
  let server;
  let client;
  let tracer;
  let id;

  beforeEach(() => {
    server = nock(/example\.com/);
    server.get('/user/10').reply(201, {name: 'Declan Harp'});
    server.get('/user/11').reply(500, {name: 'Lord Benton'});

    tracer = makeTracer();
    id = makeTraceId();
    tracer.setId(id);

    sinon.spy(tracer, 'recordBinary');

    client = request.get('http://example.com/user/10')
      .use(zipkinPlugin({tracer}));
  });

  afterEach(() => {
    tracer.recordBinary.restore();
  });

  it('should record path on request', (done) => {
    client
      .end((err, res) => {
        const {path} = res.req;
        assert(tracer.recordBinary.calledWith('http.path', path));
        done();
      });
  });

  it('should record status code on response', (done) => {
    client
      .end((err, res) => {
        const {status} = res;
        assert(tracer.recordBinary.calledWith('http.status_code', status.toString()));
        done();
      });
  });

  it('should record error on 500 response', (done) => {
    request.get('http://example.com/user/11')
      .use(zipkinPlugin({tracer}))
      .end((err, res) => {
        const {status} = res;
        assert(tracer.recordBinary.calledWith('http.status_code', '500'));
        assert(tracer.recordBinary.calledWith('error', status.toString()));
        done();
      });
  });

  it('should add zipkin headers', (done) => {
    client
      .end((err, res) => {
        const {headers} = res.req;
        assert.isTrue('x-b3-traceid' in headers);
        assert.isTrue('x-b3-spanid' in headers);
        assert.isTrue('x-b3-parentspanid' in headers);
        assert.isTrue('x-b3-sampled' in headers);
        assert.equal(headers['x-b3-traceid'], tracer.id.traceId);
        done();
      });
  });
});
