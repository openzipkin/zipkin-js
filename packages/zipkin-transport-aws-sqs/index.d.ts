// Copyright 2020 The OpenZipkin Authors; licensed to You under the Apache License, Version 2.0.

import AWS from 'aws-sdk';
import {Logger, model} from 'zipkin';

declare class AwsSqsLogger implements Logger {
    constructor(options: {
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
