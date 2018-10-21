import { expect } from 'chai';
import {Request, TraceId, option, RequestZipkinHeaders} from 'zipkin';
import Some = option.Some;

describe('Request', () => {
    describe('addZipkinHeaders', () => {
        it('should have correct return types', () => {
            const traceId = new TraceId({
                traceId: new Some('863ac35c9f6413ad48485a3953bb6124'),
                spanId: '48485a3953bb6124'
            });

            const requestWithHeaders: RequestZipkinHeaders =
                Request.addZipkinHeaders(
                    {},
                    traceId
                );

            expect(requestWithHeaders).to.have.property('headers');
        });

        it('should have correct return types when using generic', () => {
            const traceId = new TraceId({
                traceId: new Some('863ac35c9f6413ad48485a3953bb6124'),
                spanId: '48485a3953bb6124'
            });

            const requestWithCookie: RequestZipkinHeaders<{ url : string}, { cookie: string }> =
                Request.addZipkinHeaders(
                    { url: 'google.com', headers: { cookie: 'abc' } },
                    traceId
                );

            expect(requestWithCookie.headers.cookie).to.equal('abc');
            expect(requestWithCookie.url).to.equal('google.com');
        });
    });
});
