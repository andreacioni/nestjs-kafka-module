import { KafkaJS } from "@confluentinc/kafka-javascript";

export interface KafkaProducerOptions {
  conf: KafkaJS.ProducerConstructorConfig;
  autoConnect?: boolean;
}
