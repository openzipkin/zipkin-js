// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import {Tracer} from 'zipkin';

declare function wrapGot(got: any, {
  tracer: Tracer,
  serviceName: string,
  remoteServiceName: string
}): any;

export default wrapGot;
