import {Tracer, ConsoleRecorder} from 'zipkin';
import CLSContext from 'zipkin-context-cls';
import uuid from 'uuid/v4';
import express from 'express';

/**
 * Tracer factory
 * @return {zipkin.Tracer}
 */
const makeTracer = () => new Tracer({
  ctxImpl: new CLSContext(`zipkin-test-${uuid()}`),
  traceId128Bit: true,
  recorder: new ConsoleRecorder(() => {}),
});

const tracer = makeTracer();
const makeTraceId = () => tracer.createRootId();

const mockServer = () => {
  const api = express();

  api.get('/test/202', (req, res) => {
    res.status(202).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });

  api.get('/test/400', (req, res) => {
    res.status(400).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });

  api.get('/test/500', (req, res) => {
    res.status(500).json({
      traceId: req.header('X-B3-TraceId'),
      spanId: req.header('X-B3-SpanId')
    });
  });

  return api;
};

export {
  makeTracer,
  makeTraceId,
  mockServer
};
