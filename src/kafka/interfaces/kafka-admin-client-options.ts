import * as rdkafka from "@confluentinc/kafka-javascript";

export interface KafkaAdminClientOptions {
  conf: rdkafka.GlobalConfig;
}
