const trace = require('../src/trace');
describe('trace', () => {
  it('should make parent and child spans', () => {
    trace.withContext(() => {
      trace.setId(trace.cleanId());
      const parentId = trace.nextId();
      trace.setId(parentId);

      trace.withContext(() => {
        const childId = trace.nextId();
        trace.setId(childId);

        expect(trace.id().traceId).to.equal(parentId.traceId);
        expect(trace.id().parentId).to.equal(parentId.spanId);

        trace.withContext(() => {
          const grandchildId = trace.nextId();
          trace.setId(grandchildId);

          expect(trace.id().traceId).to.equal(childId.traceId);
          expect(trace.id().parentId).to.equal(childId.spanId);
        });
      });
    });
  });
});
