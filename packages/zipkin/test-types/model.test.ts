import {expect} from 'chai';
import {model, option, TraceId} from 'zipkin';

describe('Model', () => {
    describe('Endpoint', () => {
        it('should have correct type', () => {
            const endpoint: model.Endpoint = new model.Endpoint({
                serviceName: 'Unknown',
                ipv4: '10.0.0.1',
                port: 8000
            });

            expect(endpoint.setIpv4).to.be.a('function');
        });
    });
    describe('Span', () => {
        it('should have correct type', () => {
            const span: model.Span = new model.Span(new TraceId({
                traceId: 'a',
                spanId: 'b'
            }));

            expect(span.traceId).to.be.a('string');
        });
    });
});
