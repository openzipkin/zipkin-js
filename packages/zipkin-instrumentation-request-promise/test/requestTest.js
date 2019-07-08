import {assert} from 'chai';
import {} from 'co-mocha';
import nock from 'nock';
import {Request, wrapRequest} from '../src/request';
import {makeTracer, makeTraceId} from './utils';

let server;
const setup = () => {
  server = nock(/disneyland\.test/);
  server.get('/accounts/1100').reply(200, 'ok');
  server.get('/students').reply(200, ['me', 'you', 'us']);
  server.get('/food').reply(300, ['sushi', 'rice']);
  server.get('/user/10').reply(200, {name: 'Martin'});
};

describe(__filename, () => {
  describe('Using Request class', () => {
    describe('#send', () => {
      before(setup);

      const tracer = makeTracer();
      it('Should callback traceId be consistance', () => {
        const id1 = makeTraceId();
        const id2 = makeTraceId();
        tracer.setId(id1);
        const req = new Request(tracer);
        return req.send({
          uri: 'http://disneyland.test/accounts/1100',
        }).then((body) => {
          assert.equal(body, 'ok');
          assert.equal(tracer.id.traceId, id1.traceId);
          // alter traceId
          tracer.setId(id2);
        }).then(() => {
          assert.equal(tracer.id.traceId, id1.traceId);
        });
      });

      it('Should tracerId = id2 after yield', function* fn() {
        const id1 = makeTraceId();
        const id2 = makeTraceId();
        tracer.setId(id1);
        const req = new Request(tracer);
        const resolvedId = yield tracer.letId(id2, () => req.send({
          uri: 'http://disneyland.test/students',
          json: true,
        }).then((body) => {
          assert.equal(body[0], 'me');
        }).then(() => {
          assert.equal(tracer.id.traceId, id2.traceId);
          return tracer.id.traceId;
        }));
        // traceId should be restored to id2
        assert.equal(tracer.id.traceId, id2.traceId);
        assert.equal(resolvedId, id2.traceId);
      });

      it('Should restore after callback ', (done) => {
        const id1 = makeTraceId();
        const id2 = makeTraceId();
        tracer.setId(id1);
        const req = new Request(tracer);
        tracer.letId(id2, () => {
          req.send({
            uri: 'http://disneyland.test/food',
            json: true,
          }).catch((err) => {
            assert.equal(err.statusCode, '300');
            assert.equal(err.body[0], 'sushi');
          }).catch(() => {
            assert.equal(tracer.id.traceId, id2.traceId);
            done();
          });
        });
        // traceId should be restored to id1
        assert.equal(tracer.id.traceId, id1.traceId);
      });

      it('Callbacks should run in order', function* f() {
        const req = new Request(tracer);
        const resolvedData = yield req.send({
          uri: 'http://disneyland.test/user/10',
          json: true,
          resolveWithFullResponse: true,
          simple: false,
        }).then((resp) => {
          assert.equal(resp.body.name, 'Martin');
          return Promise.resolve(30);
        }).then((data) => {
          assert.equal(data, 30);
          return data;
        });
        assert.equal(resolvedData, 30);
      });
    });
  });

  describe('Using wrapRequest class', () => {
    before(setup);

    const tracer = makeTracer();
    let request = wrapRequest(tracer);
    it('Should callback traceId be consistance', () => {
      const id1 = makeTraceId();
      const id2 = makeTraceId();
      tracer.setId(id1);
      return request({
        uri: 'http://disneyland.test/accounts/1100',
      }).then((body) => {
        assert.equal(body, 'ok');
        assert.equal(tracer.id.traceId, id1.traceId);
        // alter traceId
        tracer.setId(id2);
      }).then(() => {
        assert.equal(tracer.id.traceId, id1.traceId);
      });
    });

    it('Should tracerId = id2 after yield', function* fn() {
      const id1 = makeTraceId();
      const id2 = makeTraceId();
      tracer.setId(id1);
      const req = wrapRequest(tracer);
      const resolvedId = yield tracer.letId(id2, () => req({
        uri: 'http://disneyland.test/students',
        json: true,
      }).then((body) => {
        assert.equal(body[0], 'me');
      }).then(() => {
        assert.equal(tracer.id.traceId, id2.traceId);
        return tracer.id.traceId;
      }));
      // traceId should be restore to id2
      assert.equal(tracer.id.traceId, id2.traceId);
      assert.equal(resolvedId, id2.traceId);
    });

    it('Should restore after callback ', (done) => {
      const id1 = makeTraceId();
      const id2 = makeTraceId();
      tracer.setId(id1);
      request = wrapRequest(tracer);
      tracer.letId(id2, () => {
        request({
          uri: 'http://disneyland.test/food',
          json: true,
        }).catch((err) => {
          assert.equal(err.statusCode, '300');
          assert.equal(err.body[0], 'sushi');
        }).catch(() => {
          assert.equal(tracer.id.traceId, id2.traceId);
          done();
        });
      });
      // traceId should be restored to id1
      assert.equal(tracer.id.traceId, id1.traceId);
    });

    it('Callbacks should run in order', function* f() {
      request = wrapRequest(tracer);
      const resolvedData = yield request({
        uri: 'http://disneyland.test/user/10',
        json: true,
        resolveWithFullResponse: true,
        simple: false,
      }).then((resp) => {
        assert.equal(resp.body.name, 'Martin');
        return Promise.resolve(30);
      }).then((data) => {
        assert.equal(data, 30);
        return data;
      });
      assert.equal(resolvedData, 30);
    });
  });
});
