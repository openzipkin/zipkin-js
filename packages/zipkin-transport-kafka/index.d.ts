import {KafkaClientOptions, ProducerOptions, ZKOptions} from 'kafka-node';
import {Logger, model} from 'zipkin';

declare class KafkaLogger implements Logger {
  constructor(options: {
    topic?: string,
    clientOpts?: KafkaClientOptions | {connectionString: string, clientId?: string, zkOpts: ZKOptions},
    producerOpts?: ProducerOptions,
    log?: Console
  });
  logSpan(span: model.Span): void;
}
export {KafkaLogger};
