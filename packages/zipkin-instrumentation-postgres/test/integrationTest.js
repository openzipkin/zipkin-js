const postgres = require('pg');
const zipkinClient = require('../src/zipkinClient');

delete postgres.native; // because we used to, that's why

const {setupTestTracer} = require('../../../test/testFixture');

// This instrumentation records metadata, but does not affect postgres requests otherwise. Hence,
// these tests do not expect B3 headers.
describe('Postgres instrumentation (integration test)', () => {
  const serviceName = 'weather-app';
  const remoteServiceName = 'weather-api';

  const tracer = setupTestTracer({localServiceName: serviceName});

  function clientSpan(name, tags) {
    const result = {
      name,
      kind: 'CLIENT',
      localEndpoint: {serviceName},
      remoteEndpoint: {
        port: '5432',
        serviceName: remoteServiceName
      },
    };
    if (tags) result.tags = tags;
    return result;
  }

  function getClient(done, options = {}) {
    const traced = zipkinClient(tracer.tracer(), postgres, serviceName, remoteServiceName);
    const host = options.host || 'localhost:5432';
    let {clientFunction} = options;
    if (!clientFunction) {
      clientFunction = (pg, args) => new pg.Client(args);
    }
    const result = clientFunction(traced, {
      host: host.split(':')[0],
      port: host.split(':')[1],
      database: 'postgres',
      user: 'postgres',
      password: process.env.POSTGRES_PWD
    });
    result.connect();
    if (options.expectFail || false) result.on('error', err => done(err));
    return result;
  }

  it('should record successful request', done => getClient(done).query('SELECT NOW()', () => {
    // TODO: this span name is the same for everything and so offers little value
    tracer.expectNextSpanToEqual(clientSpan('query postgres'));
    done();
  }));

  it('should record successful request :: pool',
    done => getClient(done, {clientFunction: (pg, args) => new pg.Pool(args)})
      .query('SELECT NOW()', () => {
        tracer.expectNextSpanToEqual(clientSpan('query postgres'));
        done();
      }));

  // this chains to show 3 forms of error handling
  it('should report error in tags', (done) => {
    const client = getClient(done, {expectFail: true});

    client.query('INVALID QUERY', () => {
      tracer.expectNextSpanToEqual(clientSpan('query postgres', {
        error: 'syntax error at or near "INVALID"'
      }));

      client.query('ERROR QUERY').catch(() => {
        tracer.expectNextSpanToEqual(clientSpan('query postgres', {
          error: 'syntax error at or near "ERROR"'
        }));

        client.query(new postgres.Query('FAILED QUERY()')).on('error', () => {
          tracer.expectNextSpanToEqual(clientSpan('query postgres', {
            error: 'syntax error at or near "FAILED"'
          }));
          done();
        });
      });
    });
  });

  // this chains to show 3 forms of success handling
  it('should handle nested requests', (done) => {
    const client = getClient(done);
    const queryText = 'SELECT $1::text as "res"';
    const queryValues = ['test'];

    client.query(queryText, queryValues, (error, firstResult) => {
      client.query({text: queryText, values: queryValues}).then((secondResult) => {
        const query = new postgres.Query(queryText, queryValues);
        const result = client.query(query);

        expect(query).to.equal(result);

        const submittableRows = [];
        query.on('row', row => submittableRows.push(row));
        query.on('end', () => {
          expect(firstResult.rows[0].res).to.equal('test');
          expect(secondResult.rows[0].res).to.equal('test');
          expect(submittableRows[0].res).to.equal('test');

          tracer.expectNextSpanToEqual(clientSpan('query postgres'));
          tracer.expectNextSpanToEqual(clientSpan('query postgres'));
          tracer.expectNextSpanToEqual(clientSpan('query postgres'));

          done();
        });
      });
    });
  });
});
