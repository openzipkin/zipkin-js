const sinon = require('sinon');
const {Tracer, ExplicitContext, BatchRecorder} = require('zipkin');
const zipkinClient = require('../src/zipkinClient');

const postgresConnectionOptions = {
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.POSTGRES_PWD
};

const Postgres = require('pg');
delete Postgres.native;

function getPostgres(tracer) {
  return zipkinClient(tracer, Postgres);
}

function expectCorrectSpanData(span) {
  expect(span.name).to.equal(`query ${postgresConnectionOptions.database}`);
  expect(span.localEndpoint.serviceName).to.equal('unknown');
  expect(span.remoteEndpoint.serviceName).to.equal('postgres');
  expect(span.remoteEndpoint.ipv4).to.equal(postgresConnectionOptions.host);
  expect(span.remoteEndpoint.port).to.equal(postgresConnectionOptions.port);
}

describe('postgres interceptor', () => {
  it('should add zipkin annotations', (done) => {
    const logSpan = sinon.spy();

    const ctxImpl = new ExplicitContext();
    const recorder = new BatchRecorder({logger: {logSpan}});
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Client)(postgresConnectionOptions);
    postgres.connect();
    postgres.query('SELECT NOW()', () => {
      postgres.query('SELECT NOW()').then(() => {
        const query = new Postgres.Query('SELECT NOW()');
        const result = postgres.query(query);
        result.on('end', () => {
          const spans = logSpan.args.map(arg => arg[0]);
          expect(spans).to.have.length(3);
          spans.forEach(expectCorrectSpanData);

          done();
        });
      });
    });
  });

  it('should annotate pool', (done) => {
    const logSpan = sinon.spy();

    const ctxImpl = new ExplicitContext();
    const recorder = new BatchRecorder({logger: {logSpan}});
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Pool)(postgresConnectionOptions);
    postgres.connect();
    postgres.query('SELECT NOW()', () => {
      postgres.query('SELECT NOW()').then(() => {
        const spans = logSpan.args.map(arg => arg[0]);
        expect(spans).to.have.length(2);
        spans.forEach(expectCorrectSpanData);

        done();
      });
    });
  });

  it('should annotate postgres errors', (done) => {
    const logSpan = sinon.spy();

    const ctxImpl = new ExplicitContext();
    const recorder = new BatchRecorder({logger: {logSpan}});
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Client)(postgresConnectionOptions);
    postgres.connect();

    postgres.query('INVALID QUERY', (firstError) => {
      postgres.query('ERROR QUERY').catch((secondError) => {
        const query = new Postgres.Query('FAILED QUERY()');
        const result = postgres.query(query);
        result.on('error', (thirdError) => {
          const errorTags = logSpan.args.map(arg => arg[0].tags.error);
          expect(errorTags[0]).to.equal(firstError.toString());
          expect(errorTags[1]).to.equal(secondError.toString());
          expect(errorTags[2]).to.equal(thirdError.toString());
        });

        done();
      });
    });
  });

  it('should run postgres calls', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Client)(postgresConnectionOptions);
    postgres.connect();

    const queryText = 'SELECT $1::text as "res"';
    const queryValues = ['test'];
    postgres.query(queryText, queryValues, (error, firstResult) => {
      postgres.query({text: queryText, values: queryValues}).then((secondResult) => {
        const query = new Postgres.Query(queryText, queryValues);
        const result = postgres.query(query);

        expect(query).to.equal(result);

        const submittableRows = [];
        query.on('row', (row) => submittableRows.push(row));
        query.on('end', () => {
          expect(firstResult.rows[0].res).to.equal('test');
          expect(secondResult.rows[0].res).to.equal('test');
          expect(submittableRows[0].res).to.equal('test');

          done();
        });
      });
    });
  });
});
