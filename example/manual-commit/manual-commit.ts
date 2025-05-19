import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Inject, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { KafkaModule } from "../../src/kafka/kafka.module";
import {
  KAFKA_ADMIN_CLIENT_TOKEN,
  KAFKA_CONSUMER_TOKEN,
  KAFKA_PRODUCER_TOKEN,
} from "../../src/kafka/providers/kafka.connection";

import { EachMessagePayload } from "@confluentinc/kafka-javascript/types/kafkajs";

class AppService implements OnModuleDestroy, OnModuleInit {
  private interval: NodeJS.Timeout | undefined;
  private counter: number = 0;

  constructor(
    @Inject(KAFKA_CONSUMER_TOKEN)
    private readonly consumer: KafkaJS.Consumer,
    @Inject(KAFKA_PRODUCER_TOKEN)
    private readonly producer: KafkaJS.Producer,
    @Inject(KAFKA_ADMIN_CLIENT_TOKEN) private readonly admin: KafkaJS.Admin
  ) {}

  private async consume({
    message,
    topic,
    partition,
  }: EachMessagePayload): Promise<void> {
    console.log("message received: %s", message.value?.toString());
    await this.consumer.commitOffsets([
      {
        topic: topic,
        partition: partition,
        offset: (message.offset + 1).toString(),
      },
    ]);
    console.log("message committed: %s", message.value);
  }

  private async produce(): Promise<void> {
    console.log("producing message:" + this.counter);
    const msg = Buffer.from((this.counter++).toString());

    try {
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
    } catch (e) {
      console.error("failed to produce message: %s", e);
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
    KafkaModule.forRoot({
      consumer: {
        conf: {
          "bootstrap.servers": "localhost:9092",
          "group.id": "nestjs-rdkafka-test",
          "enable.auto.commit": false,
        },
      },
      producer: {
        conf: {
          "bootstrap.servers": "localhost:9092",
          retries: 1,
          "queue.buffering.max.messages": 1,
          //"enable.idempotence": true,
        },
      },
      adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
    }),
  ],
  providers: [AppService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.enableShutdownHooks().listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
