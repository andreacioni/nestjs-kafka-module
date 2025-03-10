import * as rdkafka from "@confluentinc/kafka-javascript";

export interface KafkaProducerOptions {
  conf: rdkafka.ProducerGlobalConfig;
  topicConf?: rdkafka.ProducerTopicConfig;
  metadataConf?: rdkafka.MetadataOptions;
  autoConnect?: boolean;
}
