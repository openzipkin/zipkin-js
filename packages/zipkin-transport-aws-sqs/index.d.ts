import AWS from 'aws-sdk';
import {Logger, model} from 'zipkin';

declare class AwsSqsLogger implements Logger {
    constructor(builder: {
        queueUrl: string,
        credentialProvider?: AWS.CredentialProviderChain | undefined,
        endpointConfiguration?: AWS.Endpoint | undefined,
        region?: string | undefined,
        log?: Console,
        delaySeconds?: number,
        pollerSeconds?: number
    });

    logSpan(span: model.Span): void;
}

export {AwsSqsLogger};
