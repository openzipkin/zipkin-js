import {Agent as HttpAgent} from 'http';
import {Agent as HttpsAgent} from 'https';
import {URL} from 'url';

import {JsonEncoder, Logger, model} from 'zipkin';

type Agent = HttpAgent | HttpsAgent;

declare class HttpLogger implements Logger {
  constructor(options: {
    endpoint: string,
    httpInterval?: number,
    jsonEncoder?: JsonEncoder,
    timeout?: number,
    maxPayloadSize?: number,
    headers?: { [name: string]: any },
    agent?: Agent | ((url: URL) => Agent),
    log?: Console
  });

  logSpan(span: model.Span): void;
}
export {HttpLogger};
