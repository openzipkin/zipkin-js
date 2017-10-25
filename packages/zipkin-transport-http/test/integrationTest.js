const {
  Tracer, BatchRecorder, Annotation, ExplicitContext
} = require('zipkin');
const HttpLogger = require('../src/HttpLogger');
const express = require('express');
const bodyParser = require('body-parser');

describe('HTTP transport - integration test', () => {
  it('should send trace data via HTTP', function(done) {
    const app = express();
    app.use(bodyParser.json());
    app.post('/api/v1/spans', (req, res) => {
      res.status(202).json({});
      const traceData = req.body;
      expect(traceData.length).to.equal(1);
      expect(traceData[0].name).to.equal('GET');
      expect(traceData[0].binaryAnnotations.length).to.equal(2);
      expect(traceData[0].annotations.length).to.equal(2);
      this.server.close(done);
    });
    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${this.port}/api/v1/spans`
      });

      const ctxImpl = new ExplicitContext();
      const recorder = new BatchRecorder({logger: httpLogger});
      const tracer = new Tracer({recorder, ctxImpl});

      ctxImpl.scoped(() => {
        tracer.recordAnnotation(new Annotation.ServerRecv());
        tracer.recordServiceName('my-service');
        tracer.recordRpc('GET');
        tracer.recordBinary('http.url', 'http://example.com');
        tracer.recordBinary('http.response_code', '200');
        tracer.recordAnnotation(new Annotation.ServerSend());
      });
    });
  });
});
