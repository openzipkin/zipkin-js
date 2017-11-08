import {Logger, model} from "zipkin";
import {KafkaClientOptions, ProducerOptions, ZKOptions} from "kafka-node";

declare class KafkaLogger implements Logger {
  constructor(options: {topic?: string, clientOpts?: KafkaClientOptions | {connectionString: string, clientId?: string, zkOpts: ZKOptions}, producerOpts?: ProducerOptions});
  logSpan(span: model.Span): void;
}
export {KafkaLogger}
