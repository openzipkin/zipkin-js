// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import { expect } from 'chai';
import { InetAddress } from 'zipkin';

describe('InetAddress', () => {
  it('should have correct type', () => {
    const addr: InetAddress = new InetAddress('80.91.37.133');

    expect(addr.ipv4).to.be.a('function');
  });
});
