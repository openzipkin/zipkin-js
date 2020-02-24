const {
  Tracer, BatchRecorder, Annotation, ExplicitContext,
  jsonEncoder: {JSON_V2}
} = require('zipkin');
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fetchRetryBuilder = require('fetch-retry');
const HttpLogger = require('../src/HttpLogger');

const mockPublisher = (serverExpectations, failFirstRequest = false) => {
  const app = express();
  app.use(bodyParser.json());
  app.post('/api/v1/spans', (req, res) => {
    if (failFirstRequest && !app.firstRequestFailed) {
      app.firstRequestFailed = true;
      res.connection.end();
    } else {
      res.status(202).json({});
      serverExpectations(req, res);
    }
  });
  return app;
};

const triggerPublish = (logger) => {
  const ctxImpl = new ExplicitContext();
  const recorder = new BatchRecorder({logger});
  const tracer = new Tracer({recorder, ctxImpl});

  ctxImpl.scoped(() => {
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordServiceName('my-service');
    tracer.recordRpc('GET');
    tracer.recordBinary('http.url', 'http://example.com');
    tracer.recordBinary('http.response_code', '200');
    tracer.recordAnnotation(new Annotation.ServerSend());
  });
};

const triggerLargePublish = (logger) => {
  const ctxImpl = new ExplicitContext();
  const recorder = new BatchRecorder({logger});
  const tracer = new Tracer({recorder, ctxImpl});

  ctxImpl.scoped(() => {
    tracer.recordAnnotation(new Annotation.ServerRecv());
    tracer.recordServiceName('my-service');
    tracer.recordRpc('GET');
    tracer.recordBinary('http.url', 'http://example.com');
    tracer.recordBinary('http.response_code', '200');
    for (let i = 0; i < 20; i += 1) {
      tracer.recordAnnotation(new Annotation.Message(`Message ${i + 1}`));
    }
    tracer.recordAnnotation(new Annotation.ServerSend());
  });
};

describe('HTTP transport - integration test', () => {
  it('should send trace data via HTTP using JSON_V1', function(done) {
    const app = mockPublisher((req) => {
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
        endpoint: `http://localhost:${this.port}/api/v1/spans`,
        httpInterval: 1,
      });

      triggerPublish(httpLogger);
    });
  });

  it('should send trace data via HTTP using JSON_V2', function(done) {
    const app = mockPublisher((req) => {
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
        jsonEncoder: JSON_V2,
        httpInterval: 1
      });

      triggerPublish(httpLogger);
    });
  });

  it('should not send trace data payload larger than maxPayloadSize', function(done) {
    let publisherCount = 0;
    const maxPayloadSize = 1024;
    const app = mockPublisher((req) => {
      const contentLength = parseInt(req.headers['content-length']);
      expect(contentLength).to.be.below(maxPayloadSize);
      publisherCount += 1;
      if (publisherCount === 2) {
        this.server.close(done);
      }
    });

    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${this.port}/api/v1/spans`,
        jsonEncoder: JSON_V2,
        httpInterval: 1,
        maxPayloadSize
      });

      for (let i = 0; i < 6; i += 1) {
        triggerPublish(httpLogger);
      }
    });
  });

  it('should emit an error when payload size is too large', function(done) {
    const self = this;
    const app = mockPublisher(() => {});

    const maxPayloadSize = 1024;
    self.server = app.listen(0, () => {
      self.port = self.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${self.port}/api/v1/spans`,
        jsonEncoder: JSON_V2,
        httpInterval: 1,
        maxPayloadSize
      });

      // if an error was emitted then this works
      httpLogger.on('error', () => { self.server.close(done); });
      triggerLargePublish(httpLogger);
    });
  });

  it('should emit both payload data and an error when adding a too large span', function(done) {
    let publisherCount = 0;
    let errorEmitted = false;
    const maxPayloadSize = 1024;
    const app = mockPublisher((req) => {
      const contentLength = parseInt(req.headers['content-length']);
      expect(contentLength).to.be.below(maxPayloadSize);
      publisherCount += 2;
      if (publisherCount === 2) {
        expect(errorEmitted).to.equal(true);
        this.server.close(done);
      }
    });

    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${this.port}/api/v1/spans`,
        jsonEncoder: JSON_V2,
        httpInterval: 1,
        maxPayloadSize
      });

      // if an error was emitted then this works
      httpLogger.on('error', () => {
        errorEmitted = true;
      });

      for (let i = 0; i < 6; i += 1) {
        triggerPublish(httpLogger);
      }
      triggerLargePublish(httpLogger);
    });
  });

  it('should emit an error when an error listener is set', function(done) {
    const self = this;
    const app = mockPublisher(() => {});

    self.server = app.listen(0, () => {
      self.port = self.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${self.port}/api/v1/spans/causeerror`,
        jsonEncoder: JSON_V2,
        httpInterval: 1,
      });

      // if an error was emitted then this works
      httpLogger.on('error', () => { self.server.close(done); });
      triggerPublish(httpLogger);
    });
  });

  it('should log if an error listener is not set', function(done) {
    const self = this;
    const app = mockPublisher(() => {});

    // if an error was emitted then this works
    const log = {error: () => self.server.close(done)};

    self.server = app.listen(0, () => {
      self.port = self.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${self.port}/api/v1/spans/causeerror`,
        jsonEncoder: JSON_V2,
        httpInterval: 1,
        log
      });

      triggerPublish(httpLogger);
    });
  });

  it('should accept a 200 response from the server', function(done) {
    const self = this;
    const app = mockPublisher(() => {});

    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${this.port}/api/v1/spans`,
        jsonEncoder: JSON_V2,
        httpInterval: 1
      });

      httpLogger.on('success', () => { self.server.close(done); });
      triggerPublish(httpLogger);
    });
  });

  it('should retry with retryable fetch implementation', function(done) {
    const self = this;

    const fetchRetryOptions = Object.freeze({
      // retry on any network error, or > 408 or 5xx status codes
      retryOn: (attempt, error, response) => error !== null
        || response == null
        || response.status >= 408,
      retryDelay: tryIndex => 1000 ** tryIndex // with an exponentially growing backoff
    });

    const fetchImplementation = fetchRetryBuilder(fetch, fetchRetryOptions);
    const app = mockPublisher(() => {}, true);

    this.server = app.listen(0, () => {
      this.port = this.server.address().port;
      const httpLogger = new HttpLogger({
        endpoint: `http://localhost:${this.port}/api/v1/spans`,
        jsonEncoder: JSON_V2,
        httpInterval: 1,
        fetchImplementation
      });

      httpLogger.on('success', () => { self.server.close(done); });
      triggerPublish(httpLogger);
    });
  });
});
