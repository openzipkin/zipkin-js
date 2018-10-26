import { ExplicitContext } from 'zipkin';
import {expect} from 'chai';

describe('ExplicitContext', () => {
    it('should return correct type', () => {
        const explicitContext: ExplicitContext = new ExplicitContext();

        expect(explicitContext.scoped).to.be.a('function');
    });
});
