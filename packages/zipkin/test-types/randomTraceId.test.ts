// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import { expect } from 'chai';
import { randomTraceId } from 'zipkin';

describe('RandomTraceId', () => {
  it('should return string', () => {
    const rand = randomTraceId();

    expect(rand).to.be.a('string');
  });
});
