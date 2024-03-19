import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { IAdminClient, KafkaConsumer, Producer } from "node-rdkafka";
import { KafkaConnectionOptions } from "../interfaces/kafka-connection-options";
import {
  consumerConnect,
  consumerDisconnect,
  producerConnect,
  producerDisconnect,
} from "../utils/kafka.utils";

/**
 * Handle lifecycle events on `KafkaModule`. In case `autoConnect` parameter
 * is set this module is responsible to connect/disconnect the providers.
 * @internal
 */
export default class KafkaLifecycleManager
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly config: KafkaConnectionOptions,
    private readonly producer: Producer,
    private readonly consumer: KafkaConsumer,
    private readonly client: IAdminClient
  ) {}

  async onModuleDestroy() {
    if (
      (this.config?.consumer?.autoConnect ?? true) &&
      this.consumer &&
      this.consumer.isConnected()
    ) {
      await consumerDisconnect(this.consumer);
    }

    if (
      (this.config?.producer?.autoConnect ?? true) &&
      this.producer &&
      this.producer.isConnected()
    ) {
      await producerDisconnect(this.producer);
    }

    this.client?.disconnect();
  }

  async onModuleInit() {
    if ((this.config?.consumer?.autoConnect ?? true) && this.consumer) {
      await consumerConnect(this.consumer, this.config?.consumer?.metadataConf);
    }

    if ((this.config?.producer?.autoConnect ?? true) && this.producer) {
      await producerConnect(this.producer, this.config?.producer?.metadataConf);
    }
  }
}
