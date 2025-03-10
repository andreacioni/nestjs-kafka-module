import * as rdkafka from "@confluentinc/kafka-javascript";

export interface KafkaConsumerOptions {
  conf: rdkafka.ConsumerGlobalConfig;
  topicConf?: rdkafka.ConsumerTopicConfig;
  metadataConf?: rdkafka.MetadataOptions;
  autoConnect?: boolean;
}
