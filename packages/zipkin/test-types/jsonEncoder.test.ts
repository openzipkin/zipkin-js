import { expect } from 'chai';
import { jsonEncoder, JsonEncoder, model, option, TraceId } from 'zipkin';

describe('JsonEncoder', () => {
    it('should have correct type', () => {
        const v1: JsonEncoder = jsonEncoder.JSON_V1;
        const v2: JsonEncoder = jsonEncoder.JSON_V2;

        const span: model.Span = new model.Span(new TraceId({ spanId: 'xyz' }));

        expect(v1.encode(span)).to.be.a('string');
        expect(v2.encode(span)).to.be.a('string');
    });
});
