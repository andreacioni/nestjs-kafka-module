import { KafkaJS } from "@confluentinc/kafka-javascript";
import { BeforeApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { KafkaConnectionOptions } from "../interfaces/kafka-connection-options";
import { debugLog } from "../utils/kafka.utils";

/**
 * Manages lifecycle events for the `KafkaModule`. When the `autoConnect`
 * parameter is enabled, this class ensures the proper connection and
 * disconnection of Kafka providers (producer and consumer) during the
 * application's lifecycle.
 * @internal
 */
export default class KafkaLifecycleManager
  implements BeforeApplicationShutdown, OnModuleInit
{
  constructor(
    private readonly config: KafkaConnectionOptions,
    private readonly producer: KafkaJS.Producer,
    private readonly consumer: KafkaJS.Consumer,
    private readonly admin: KafkaJS.Admin
  ) {}

  async beforeApplicationShutdown() {
    if ((this.config?.consumer?.autoConnect ?? true) && this.consumer) {
      try {
        debugLog("Consumer disconnecting");
        await this.consumer.disconnect();
        debugLog("Consumer disconnected successfully.");
      } catch (e) {
        console.error("failed to disconnect consumer: %s", e);
      }
    }

    if ((this.config?.producer?.autoConnect ?? true) && this.producer) {
      try {
        debugLog("Producer disconnecting");
        await this.producer.flush();
        await this.producer.disconnect();
        debugLog("Producer disconnected successfully.");
      } catch (e) {
        console.error("failed to disconnect producer: %s", e);
      }
    }

    if ((this.config.adminClient?.autoConnect ?? true) && this.admin) {
      try {
        debugLog("Admin client disconnecting");
        await this.admin.disconnect();
        debugLog("Admin client disconnected successfully.");
      } catch (e) {
        console.error("failed to disconnect admin client: %s", e);
      }
    }
  }

  async onModuleInit() {
    if ((this.config?.consumer?.autoConnect ?? true) && this.consumer) {
      debugLog("Consumer connecting");
      await this.consumer.connect();
      debugLog("Consumer connected successfully.");
    }

    if ((this.config?.producer?.autoConnect ?? true) && this.producer) {
      debugLog("Producer connecting");
      await this.producer.connect();
      debugLog("Producer connected successfully.");
    }

    if ((this.config?.adminClient?.autoConnect ?? true) && this.admin) {
      debugLog("Admin client connecting");
      await this.admin.connect();
      debugLog("Admin client connected successfully.");
    }
  }
}
