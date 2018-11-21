import {expect} from 'chai';
import { BatchRecorder, ConsoleRecorder, Logger, model } from 'zipkin';

describe('Recorder types', () => {
    describe('BatchRecorder', () => {
        it('should return correct type', () => {
            class Log implements Logger {
                logSpan(span: model.Span): void {
                }
            }
            const batchRecorder: BatchRecorder = new BatchRecorder({
                logger: new Log(),
                timeout: 1000
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
