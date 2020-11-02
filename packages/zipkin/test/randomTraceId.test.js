// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

const randomTraceId = require('../src/tracer/randomTraceId');

describe('random trace id', () => {
  it('should have fixed length of 16 characters', () => {
    for (let i = 0; i < 100; i += 1) {
      const rand = randomTraceId();
      expect(rand.length).to.equal(16);
    }
  });
});
