import {JsonEncoder, Logger, model} from "zipkin"

declare class HttpLogger implements Logger {
  constructor(options: {endpoint: string, httpInterval?: number, jsonEncoder?: JsonEncoder, httpTimeout?: number, headers?: { [name: string]: any }});
  logSpan(span: model.Span): void;
}
export {HttpLogger}
