import {expect} from 'chai';
import {ConsoleRecorder, ExplicitContext, Instrumentation, Tracer} from 'zipkin';

describe('Instrumentation', () => {
    describe('HttpClient', () => {
        it('should have correct type', () => {
            const instrumentation: Instrumentation.HttpClient = new Instrumentation.HttpClient({
                    tracer: new Tracer({
                        ctxImpl: new ExplicitContext(),
                        recorder: new ConsoleRecorder()
                    }),
                    serviceName: 'weather-app',
                    remoteServiceName: 'weather-forecast-service'
                }
            );

            expect(instrumentation.recordRequest).to.be.a('function');
        });
    });
    describe('HttpServer', () => {
        it('should have correct type', () => {
            const instrumentation: Instrumentation.HttpServer = new Instrumentation.HttpServer({
                    tracer: new Tracer({
                        ctxImpl: new ExplicitContext(),
                        recorder: new ConsoleRecorder()
                    }),
                    port: 8000
                }
            );

            expect(instrumentation.recordRequest).to.be.a('function');
        });
    });
});
