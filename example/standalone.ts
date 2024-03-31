import { Inject, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IAdminClient, KafkaConsumer, Message, Producer } from "node-rdkafka";
import { KafkaModule } from "../src/kafka/kafka.module";
import { KAFKA_ADMIN_CLIENT_PROVIDER } from "../src/kafka/providers/kafka.connection";

import { promisify } from "node:util";

class AppService implements OnModuleDestroy, OnModuleInit {
  private interval: NodeJS.Timeout | undefined;
  private counter: number = 0;

  constructor(
    private readonly consumer: KafkaConsumer,
    private readonly producer: Producer,
    @Inject(KAFKA_ADMIN_CLIENT_PROVIDER) private readonly admin: IAdminClient
  ) {}

  private consume(message: Message): void {
    console.log("message received: %s", message.value);
  }

  private produce(): void {
    const msg = Buffer.from((this.counter++).toString());
    this.producer.produce("DEMO_TOPIC", null, msg);
    console.log("message sent: %s", msg);
  }

  async onModuleInit() {
    //CONSUMER
    this.consumer.subscribe(["DEMO_TOPIC"]);
    this.consumer.on("data", this.consume.bind(this));
    this.consumer.consume();

    //PRODUCE
    this.interval = setInterval(this.produce.bind(this), 1000);
  }

  async onModuleDestroy(signal?: string) {
    console.log("received signal: %s", signal);
    try {
      clearInterval(this.interval);
      await promisify(this.producer.flush.bind(this.producer))(10000);
      this.consumer.unsubscribe();
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
          "group.id": "nestjs-rdkafka-test",
          "metadata.broker.list": "127.0.0.1:9092",
        },
      },
      producer: {
        conf: {
          "metadata.broker.list": "127.0.0.1:9092",
        },
      },
      adminClient: {
        conf: {
          "metadata.broker.list": "127.0.0.1:9092",
        },
      },
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
