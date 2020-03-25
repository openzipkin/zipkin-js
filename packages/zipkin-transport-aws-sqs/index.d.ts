// @ts-ignore
import AWS from 'aws-sdk';
import {Logger, model} from 'zipkin';

declare class AwsSqsLogger implements Logger {
    constructor(options: {
        queueUrl: string,
        awsConfig?: AWS.ConfigurationOptions | null,
        log?: Console
        encoder: string,
        delaySeconds?: number,
        pollerSeconds?: number,
        maxPayloadSize?: number,
        errorListenerSet?: boolean,
    });

    logSpan(span: model.Span): void;
}

export {AwsSqsLogger};
