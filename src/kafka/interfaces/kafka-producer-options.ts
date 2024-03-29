import * as rdkafka from "node-rdkafka";

export interface KafkaProducerOptions {
  conf: rdkafka.ProducerGlobalConfig;
  topicConf?: rdkafka.ProducerTopicConfig;
  metadataConf?: rdkafka.MetadataOptions;
  autoConnect?: boolean;
}
