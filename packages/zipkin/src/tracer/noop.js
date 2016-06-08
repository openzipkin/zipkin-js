const Tracer = require('./');
const ExplicitContext = require('../explicit-context');

module.exports = function createNoopTracer() {
  const recorder = {record() { }};
  const ctxImpl = new ExplicitContext();
  return new Tracer({recorder, ctxImpl});
};
