const sinon = require('sinon');
const {Tracer, ExplicitContext, InetAddress} = require('zipkin');
const zipkinClient = require('../src/zipkinClient');

const postgresConnectionOptions = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.POSTGRES_PWD
};

const Postgres = require('pg');

function getPostgres(tracer) {
  return zipkinClient(tracer, Postgres);
}

function expectAnnotationsDescribePostgresInteraction(annotations) {
  const sn = annotations[1].annotation;
  expect(sn.annotationType).to.equal('ServiceName');
  expect(sn.serviceName).to.equal('unknown');

  const sa = annotations[2].annotation;
  expect(sa.annotationType).to.equal('ServerAddr');
  expect(sa.serviceName).to.equal('postgres');
  expect(sa.host).to.deep.equal(new InetAddress('localhost'));
  expect(sa.port).to.equal(5432);
}

function expectAnnotationsBelongToTheSameSpan(annotations) {
  let lastSpanId;
  annotations.forEach((ann) => {
    if (!lastSpanId) {
      lastSpanId = ann.traceId.spanId;
    }
    expect(ann.traceId.spanId).to.equal(lastSpanId);
  });
}

function expectErrorAnnotation(annotation, error) {
  expect(annotation.annotation.key).to.equal('error');
  expect(annotation.annotation.value).to.equal(error.toString());
}

function runTest(annotations) {
  expectAnnotationsDescribePostgresInteraction(annotations);
  expectAnnotationsBelongToTheSameSpan(annotations);
}

describe('postgres interceptor', () => {
  it('should add zipkin annotations', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Client)(postgresConnectionOptions);
    postgres.connect();
    postgres.query('SELECT NOW()', () => {
      postgres.query('SELECT NOW()').then(() => {
        const query = new Postgres.Query('SELECT NOW()');
        const result = postgres.query(query);
        result.on('end', () => {
          const annotations = recorder.record.args.map(args => args[0]);
          const firstAnn = annotations[0];
          expect(annotations).to.have.length(15);

          // we expect three spans, run annotations tests for each
          runTest(annotations.slice(0, 5));
          runTest(annotations.slice(5, 10));
          runTest(annotations.slice(10, 15));

          expect(
            annotations[0].traceId.spanId
          ).not.to.equal(annotations[5].traceId.spanId);
          expect(
            annotations[0].traceId.spanId
          ).not.to.equal(annotations[10].traceId.spanId);

          annotations.forEach(ann => {
            expect(ann.traceId.parentId).to.equal(firstAnn.traceId.traceId);
            expect(ann.traceId.spanId).not.to.equal(firstAnn.traceId.traceId);
            expect(ann.traceId.traceId).to.equal(firstAnn.traceId.traceId);
          });

          done();
        });
      });
    });
  });

  it('should annotate postgres errors', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Client)(postgresConnectionOptions);
    postgres.connect();

    postgres.query('INVALID QUERY', (firstError) => {
      postgres.query('ERROR QUERY').catch((secondError) => {
        const query = new Postgres.Query('FAILED QUERY()');
        const result = postgres.query(query);
        result.on('error', (thirdError) => {
          const annotations = recorder.record.args.map(args => args[0]);
          expectErrorAnnotation(annotations[5], firstError);
          expectErrorAnnotation(annotations[11], secondError);
          expectErrorAnnotation(annotations[17], thirdError);
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

  it('should annotate pool', (done) => {
    const ctxImpl = new ExplicitContext();
    const recorder = {record: sinon.spy()};
    const tracer = new Tracer({ctxImpl, recorder});
    tracer.setId(tracer.createRootId());

    const postgres = new (getPostgres(tracer).Pool)(postgresConnectionOptions);
    postgres.connect();
    postgres.query('SELECT NOW()', () => {
      postgres.query('SELECT NOW()').then(() => {
        const annotations = recorder.record.args.map(args => args[0]);
        expect(annotations).to.have.length(10);

        done();
      });
    });
  });
});
