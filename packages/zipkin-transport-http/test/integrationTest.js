const {
  Tracer, BatchRecorder, Annotation, ExplicitContext,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const HttpLogger = require('../src/HttpLogger');
const express = require('express');
const bodyParser = require('body-parser');

describe('HTTP transport - integration test', () => {
  it('should send trace data via HTTP using JSON_V1', function(done) {
    const app = express();
    app.use(bodyParser.json());
    app.post('/api/v1/spans', (req, res) => {
      res.status(202).json({});
      expect(req.headers['content-type']).to.equal('application/json');
      const traceData = req.body;
      expect(traceData.length).to.equal(1);
      expect(traceData[0].name).to.equal('get');
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

  it('should send trace data via HTTP using JSON_V2', function(done) {
    const app = express();
    app.use(bodyParser.json());
    app.post('/api/v1/spans', (req, res) => {
      res.status(202).json({});
      expect(req.headers['content-type']).to.equal('application/json');
      expect(req.headers.authorization).to.equal('Token');
      const traceData = req.body;
      expect(traceData.length).to.equal(1);
      expect(traceData[0].name).to.equal('get');
      expect(traceData[0].kind).to.equal('SERVER');
      expect(traceData[0].tags['http.url']).to.equal('http://example.com');
      expect(traceData[0].tags['http.response_code']).to.equal('200');
      this.server.close(done);
    });
    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${this.port}/api/v1/spans`,
        headers: {Authorization: 'Token'},
        jsonEncoder: JSON_V2
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

  it('should emit an error when an error listener is set', function(done) {
    const self = this;
    const app = express();
    app.use(bodyParser.json());
    app.post('/api/v1/spans', (req, res) => {
      res.status(202).json({});
    });
    self.server = app.listen(0, () => {
      self.port = self.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${self.port}/api/v1/spans/causeerror`,
        headers: {Authorization: 'Token'},
        jsonEncoder: JSON_V2
      });

      httpLogger.on('error', () => {
        // if an error was emitted then this works
        self.server.close(done);
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
