import { ConsoleRecorder, BatchRecorder, Logger, model } from 'zipkin';
import {expect} from 'chai';

describe('Recorder types', () => {
    describe('BatchRecorder', () => {
        it('should return correct type', () => {
            const batchRecorder: BatchRecorder = new BatchRecorder({
                logger: new class implements Logger {
                    logSpan(span: model.Span): void {
                    }
                },
                timeout: 1000,
            });

            expect(batchRecorder.record).to.be.a('function');
        });
    });
    describe('ConsoleRecorder', () => {
        it('should ConsoleRecorder return correct type', () => {
            const consoleRecorder: ConsoleRecorder = new ConsoleRecorder();

            expect(consoleRecorder.record).to.be.a('function');
        });
    });
});
