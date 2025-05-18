import { KafkaJS } from "@confluentinc/kafka-javascript";
// import { HealthIndicatorService } from "@nestjs/terminus";
import { debugLog } from "../utils/kafka.utils";

export class KafkaHealthIndicator {
  constructor(
    private readonly healthIndicatorService?: any, //HealthIndicatorService
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
