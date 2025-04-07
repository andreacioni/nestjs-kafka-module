import { KafkaJS } from "@confluentinc/kafka-javascript";

export interface KafkaConsumerOptions {
  conf: KafkaJS.ConsumerConstructorConfig;
  autoConnect?: boolean;
}
