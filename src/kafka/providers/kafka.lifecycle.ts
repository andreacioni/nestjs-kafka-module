import {
  IAdminClient,
  KafkaConsumer,
  Producer,
} from "@confluentinc/kafka-javascript";
import { BeforeApplicationShutdown, OnModuleInit } from "@nestjs/common";
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
  implements BeforeApplicationShutdown, OnModuleInit
{
  constructor(
    private readonly config: KafkaConnectionOptions,
    private readonly producer: Producer,
    private readonly consumer: KafkaConsumer,
    private readonly client: IAdminClient
  ) {}

  async beforeApplicationShutdown() {
    if (
      (this.config?.producer?.autoConnect ?? true) &&
      this.producer &&
      this.producer.isConnected()
    ) {
      try {
        await producerDisconnect(this.producer);
      } catch (e) {
        console.error("failed to disconnect producer: %s", e);
      }
    }

    if (
      (this.config?.consumer?.autoConnect ?? true) &&
      this.consumer &&
      this.consumer.isConnected()
    ) {
      try {
        await consumerDisconnect(this.consumer);
      } catch (e) {
        console.error("failed to disconnect consumer: %s", e);
      }
    }

    try {
      this.client?.disconnect();
    } catch (e) {
      console.error("failed to disconnect admin client: %s", e);
    }
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
