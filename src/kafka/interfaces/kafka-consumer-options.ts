import * as rdkafka from "node-rdkafka";

export interface KafkaConsumerOptions {
  conf: rdkafka.ConsumerGlobalConfig;
  topicConf?: rdkafka.ConsumerTopicConfig;
  metadataConf?: rdkafka.MetadataOptions;
  autoConnect?: boolean;
}
