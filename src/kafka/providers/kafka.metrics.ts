import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Inject } from "@nestjs/common";
import { KafkaConnectionOptions } from "../interfaces/kafka-connection-options";
import {
  KAFKA_ADMIN_CLIENT_TOKEN,
  KAFKA_CONFIGURATION_TOKEN,
  KAFKA_CONSUMER_TOKEN,
} from "./kafka.connection";

type KafkaTopicMetrics = Record<string, KafkaPartitionMetrics>;

type KafkaPartitionMetrics = Record<string, KafkaMetrics>;

export interface KafkaMetrics {
  lag?: number;
  consumerOffset?: number;
  producerOffset?: number;
}

export class KafkaMetricsService {
  constructor(
    @Inject(KAFKA_ADMIN_CLIENT_TOKEN) private readonly admin?: KafkaJS.Admin,
    @Inject(KAFKA_CONFIGURATION_TOKEN)
    private readonly config?: KafkaConnectionOptions,
    @Inject(KAFKA_CONSUMER_TOKEN)
    private readonly consumer?: KafkaJS.Consumer
  ) {}

  async getMetrics(): Promise<KafkaTopicMetrics> {
    this.checkPrerequisites();

    const topicMetrics: KafkaTopicMetrics = {};
    const consumerGroupId = this.config?.consumer?.["group.id"];

    if (consumerGroupId) {
      try {
        const topics =
          this.consumer?.assignment()?.map((topic) => topic.topic) ?? [];

        //Fetch consumer offsets for the consumer group
        const consumerOffsets = await this.admin!.fetchOffsets({
          groupId: consumerGroupId,
        });
        this.populateConsumerOffsetForTopic(consumerOffsets, topicMetrics);

        for (const topic of topics) {
          if (!topicMetrics[topic]) {
            topicMetrics[topic] = {};
          }

          //Fetch producer offsets
          const producerOffset = await this.admin!.fetchTopicOffsets(topic);

          this.populateProducerOffsetForTopic(
            topic,
            producerOffset,
            topicMetrics
          );

          this.evaluateLag(topicMetrics);
        }
      } catch (e) {
        console.error("failed to collect metrics: %s", e);
      }
    }

    return topicMetrics;
  }

  private evaluateLag(topicMetrics: KafkaTopicMetrics) {
    for (const [, partitions] of Object.entries(topicMetrics)) {
      for (const [, metrics] of Object.entries(partitions)) {
        const { consumerOffset, producerOffset } = metrics;

        if (consumerOffset !== undefined && producerOffset !== undefined) {
          metrics.lag = producerOffset - consumerOffset;
        }
      }
    }
  }

  private populateConsumerOffsetForTopic(
    consumerOffsets: Array<{
      topic: string;
      partitions: KafkaJS.FetchOffsetsPartition[];
    }>,
    topicMetrics: KafkaTopicMetrics
  ) {
    consumerOffsets.forEach((offset) => {
      if (!topicMetrics[offset.topic]) {
        topicMetrics[offset.topic] = {};
      }
      offset.partitions.forEach((partition) => {
        if (!topicMetrics[offset.topic][partition.partition]) {
          topicMetrics[offset.topic][partition.partition] = {};
        }
        topicMetrics[offset.topic][partition.partition].consumerOffset =
          Number.parseInt(partition.offset);
      });
    });
  }

  private populateProducerOffsetForTopic(
    topic: string,
    producerOffset: Array<KafkaJS.SeekEntry & { high: string; low: string }>,
    topicMetrics: KafkaTopicMetrics
  ) {
    producerOffset.forEach((offset) => {
      if (!topicMetrics[topic]) {
        topicMetrics[topic] = {};
      }
      if (!topicMetrics[topic][offset.partition]) {
        topicMetrics[topic][offset.partition] = {};
      }
      topicMetrics[topic][offset.partition].producerOffset = Number.parseInt(
        offset.offset
      );
    });
  }

  private checkPrerequisites(): void {
    const consumerGroupId = this.config?.consumer?.conf["group.id"];

    if (!consumerGroupId) {
      throw new Error(
        "Consumer group id not provided. Did you forget to provide 'group.id' in consumer configuration?"
      );
    }
    if (!this.admin) {
      throw new Error(
        "Admin client not provided. Did you forget to provide 'adminClient' configuration in KafkaModule?"
      );
    }
    if (!this.consumer) {
      throw new Error(
        "Consumer not provided. Did you forget to provide 'consumer' configuration in KafkaModule?"
      );
    }
  }
}
