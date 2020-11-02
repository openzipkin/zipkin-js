// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import {expect} from 'chai';
import { ExplicitContext } from 'zipkin';

describe('ExplicitContext', () => {
    it('should return correct type', () => {
        const explicitContext: ExplicitContext = new ExplicitContext();

        expect(explicitContext.scoped).to.be.a('function');
    });
});
