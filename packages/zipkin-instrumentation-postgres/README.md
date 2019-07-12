# zipkin-instrumentation-postgres

![npm](https://img.shields.io/npm/dm/zipkin-instrumentation-postgres.svg)

This library will wrap the [pg client](https://www.npmjs.com/package/pg).

## Usage

```javascript
const {Tracer} = require('zipkin');
const Postgres = require('pg');
const zipkinClient = require('zipkin-instrumentation-postgres');

const tracer = new Tracer({ctxImpl, recorder}); // configure your tracer properly here

const ZipkinPostgres = zipkinClient(tracer, Postgres);

const connectionOptions = {
  user: 'postgres',
  password: 'secret',
  host: 'localhost',
  database: 'mydb'
};

const client = new ZipkinPostgres.Client(connectionOptions);
const pool = new ZipkinPostgres.Pool(connectionOptions);

// Your application code here
client.query('SELECT NOW()', (err, result) => {
  console.log(err, result);
});

pool.query('SELECT NOW()')
  .then(console.log)
  .catch(console.error);
```
