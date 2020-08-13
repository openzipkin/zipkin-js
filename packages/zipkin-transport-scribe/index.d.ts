// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import {Logger, model} from 'zipkin';

declare class ScribeLogger implements Logger {
  constructor(options: {
    scribeHost: string,
    scribePort?: number,
    scribeInterval?: number,
    log?: Console
  });
  logSpan(span: model.Span): void;
}
export {ScribeLogger};
