import {Agent as HttpAgent} from 'http';
import {Agent as HttpsAgent} from 'https';
import {URL} from 'url';

import {JsonEncoder, Logger, model} from 'zipkin';

type Agent = HttpAgent | HttpsAgent;

interface ErrorLogger {
  error(...args: any[]): void;
}

declare class HttpLogger implements Logger {
  /**
   * @constructor
   * @param {Object} options
   * @param {string} options.endpoint HTTP endpoint which spans will be sent
   * @param {number} options.httpInterval How often to sync spans.
   * @param {JsonEncoder} options.jsonEncoder JSON encoder to use when sending spans.
   * @param {number} options.timeout Timeout for HTTP Post when sending spans.
   * @param {number} options.maxPayloadSize Max payload size for zipkin span.
   * @param {Object<string, string>} options.headers Any additional HTTP headers to be sent with span.
   * @param {Agent|Function} options.agent HTTP(S) agent to use for any networking related options.
   * @param {ErrorLogger} options.log Internal error logger used within the transport.
   */
  constructor(options: {
    endpoint: string,
    httpInterval?: number,
    jsonEncoder?: JsonEncoder,
    timeout?: number,
    maxPayloadSize?: number,
    headers?: { [name: string]: string },
    agent?: Agent | ((url: URL) => Agent),
    log?: ErrorLogger
  });

  logSpan(span: model.Span): void;
}
export {HttpLogger};
