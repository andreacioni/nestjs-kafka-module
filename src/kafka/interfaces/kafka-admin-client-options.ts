import { KafkaJS } from "@confluentinc/kafka-javascript";

export interface KafkaAdminClientOptions {
  autoConnect?: boolean;
  conf: KafkaJS.AdminConstructorConfig;
}
