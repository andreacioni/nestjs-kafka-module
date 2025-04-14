import { IAdminClient, KafkaJS } from "@confluentinc/kafka-javascript";
import { EachMessagePayload } from "@confluentinc/kafka-javascript/types/kafkajs";
import {
  Controller,
  Get,
  Inject,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  HealthCheck,
  HealthCheckService,
  TerminusModule,
} from "@nestjs/terminus";
import { KafkaModule } from "../../src/kafka/kafka.module";
import {
  KAFKA_ADMIN_CLIENT_PROVIDER,
  KAFKA_CONSUMER_PROVIDER,
  KAFKA_PRODUCER_PROVIDER,
} from "../../src/kafka/providers/kafka.connection";
import { KafkaHealthIndicator } from "../../src/kafka/providers/kafka.health";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private kafkaHealthIndicator: KafkaHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  healthCheck() {
    return this.health.check([() => this.kafkaHealthIndicator.isHealty()]);
  }
}

class AppService implements OnModuleDestroy, OnModuleInit {
  private interval: NodeJS.Timeout | undefined;
  private counter: number = 0;

  constructor(
    @Inject(KAFKA_CONSUMER_PROVIDER)
    private readonly consumer: KafkaJS.Consumer,
    @Inject(KAFKA_PRODUCER_PROVIDER)
    private readonly producer: KafkaJS.Producer,
    @Inject(KAFKA_ADMIN_CLIENT_PROVIDER) private readonly admin: IAdminClient
  ) {}

  private async consume({
    message,
    topic,
    partition,
  }: EachMessagePayload): Promise<void> {
    console.log("message received: %s", message.value?.toString());
  }

  private async produce(): Promise<void> {
    const msg = Buffer.from((this.counter++).toString());
    const res = await this.producer.send({
      topic: "DEMO_TOPIC",
      messages: [{ value: msg }],
    });
    for (const record of res) {
      if (record.errorCode !== 0) {
        throw new Error("error sending message: " + record.errorCode);
      }
      console.log("message sent");
    }
  }

  async onModuleInit() {
    //CONSUMER
    await this.consumer.subscribe({ topics: ["DEMO_TOPIC"] });
    this.consumer.run({
      eachMessage: this.consume.bind(this),
    });

    //PRODUCER
    this.interval = setInterval(this.produce.bind(this), 1000);
  }

  async onModuleDestroy(signal?: string) {
    console.log("received signal: %s", signal);
    try {
      clearInterval(this.interval);
      await this.producer.flush.bind(this.producer)({ timeout: 10000 });
    } catch (e) {
      console.error("failed to shutdown app service");
    }
  }
}

@Module({
  imports: [
    TerminusModule.forRoot({
      gracefulShutdownTimeoutMs: 10000,
    }),
    KafkaModule.forRoot({
      consumer: {
        conf: {
          "bootstrap.servers": "localhost:9092",
          "group.id": "nestjs-rdkafka-test",
        },
      },
      producer: {
        conf: {
          "bootstrap.servers": "localhost:9092",
        },
      },
      adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
    }),
  ],
  providers: [AppService],
  controllers: [HealthController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.enableShutdownHooks().listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
