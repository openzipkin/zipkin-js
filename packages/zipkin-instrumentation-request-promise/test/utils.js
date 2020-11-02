// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import {Tracer, ConsoleRecorder} from 'zipkin';
import CLSContext from 'zipkin-context-cls';
import uuid from 'uuid/v4';

const makeTracer = () => {
  const tracer = new Tracer({
    ctxImpl: new CLSContext(`zipkin-test-${uuid()}`),
    traceId128Bit: true,
    recorder: new ConsoleRecorder(() => {}),
  });
  return tracer;
};

const tracer = makeTracer();

const makeTraceId = () => tracer.createRootId();

export {
  makeTracer,
  makeTraceId,
};
