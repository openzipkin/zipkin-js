import {JsonEncoder, Logger, model} from "zipkin"

declare class HttpLogger implements Logger {
  constructor(options: {endpoint: string, httpInterval?: number, jsonEncoder?: JsonEncoder, httpTimeout?: number});
  logSpan(span: model.Span): void;
}
export {HttpLogger}
