import { IAdminClient, KafkaJS } from "@confluentinc/kafka-javascript";
import { Inject, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { KafkaModule } from "../../src/kafka/kafka.module";
import { KAFKA_ADMIN_CLIENT_PROVIDER } from "../../src/kafka/providers/kafka.connection";

import { EachMessagePayload } from "@confluentinc/kafka-javascript/types/kafkajs";
import { promisify } from "node:util";

class AppService implements OnModuleDestroy, OnModuleInit {
  private interval: NodeJS.Timeout | undefined;
  private counter: number = 0;

  constructor(
    private readonly consumer: KafkaJS.Consumer,
    private readonly producer: KafkaJS.Producer,
    @Inject(KAFKA_ADMIN_CLIENT_PROVIDER) private readonly admin: IAdminClient
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
    const msg = Buffer.from((this.counter++).toString());
    const res = await this.producer.send({
      topic: "DEMO_TOPIC",
      messages: [{ value: msg }],
    });
    console.log("message sent: %s", res);
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
      await promisify(this.producer.flush.bind(this.producer))(10000);
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
          "enable.idempotence": true,
          "queue.buffering.max.messages": 10,
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
