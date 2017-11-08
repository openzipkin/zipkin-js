import {Logger, model} from "zipkin";

declare class ScribeLogger implements Logger {
  constructor(options: {scribeHost: string, scribePort?: number, scribeInterval?: number});
  logSpan(span: model.Span): void;
}
export {ScribeLogger}
