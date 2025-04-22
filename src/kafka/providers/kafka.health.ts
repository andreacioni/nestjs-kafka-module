import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Inject } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { debugLog } from "../utils/kafka.utils";
import { KAFKA_ADMIN_CLIENT_TOKEN } from "./kafka.connection";

export class KafkaHealthIndicator {
  constructor(
    private readonly healthIndicatorService?: HealthIndicatorService,
    @Inject(KAFKA_ADMIN_CLIENT_TOKEN)
    private readonly adminClient?: KafkaJS.Admin
  ) {}

  async isHealty() {
    if (!this.healthIndicatorService) {
      throw new Error(
        "Kafka admin client not provided. Did you forget to inject TerminusModule?"
      );
    }

    if (!this.adminClient) {
      throw new Error(
        "Kafka admin client not provided. Did you forget to provide 'adminClient' configuration in KafkaModule?"
      );
    }

    const indicator = this.healthIndicatorService.check("kafka");
    try {
      await this.adminClient.fetchTopicMetadata();
      return indicator.up();
    } catch (error) {
      debugLog(`Kafka health check failed: ${error}`);
      return indicator.down();
    }
  }
}
