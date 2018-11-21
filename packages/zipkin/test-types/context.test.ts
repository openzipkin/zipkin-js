import {expect} from 'chai';
import { ExplicitContext } from 'zipkin';

describe('ExplicitContext', () => {
    it('should return correct type', () => {
        const explicitContext: ExplicitContext = new ExplicitContext();

        expect(explicitContext.scoped).to.be.a('function');
    });
});
