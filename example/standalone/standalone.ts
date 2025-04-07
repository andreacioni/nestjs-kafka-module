import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Inject, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { KAFKA_CONSUMER, KAFKA_PRODUCER, KafkaModule } from "../../src/index";

class AppService implements OnModuleDestroy, OnModuleInit {
  private interval: NodeJS.Timeout | undefined;
  private counter: number = 0;

  constructor(
    @Inject(KAFKA_PRODUCER) private readonly producer: KafkaJS.Producer,
    @Inject(KAFKA_CONSUMER) private readonly consumer: KafkaJS.Consumer
  ) {}

  private async consume(message: KafkaJS.EachMessagePayload) {
    console.log("message received: %s", message?.message?.value?.toString());
  }

  private async produce() {
    const msg: KafkaJS.Message = {
      value: `${this.counter++}`,
    };
    const record: KafkaJS.ProducerRecord = {
      topic: "DEMO_TOPIC",
      messages: [msg],
    };
    await this.producer.send(record);
    console.log("message sent: %s", msg?.value?.toString());
  }

  async onModuleInit() {
    //CONSUMER
    await this.consumer.subscribe({ topics: ["DEMO_TOPIC"] });
    await this.consumer.run({ eachMessage: this.consume.bind(this) });

    //PRODUCE
    this.interval = setInterval(this.produce.bind(this), 1000);
  }

  async onModuleDestroy(signal?: string) {
    console.log("received signal: %s", signal);
    try {
      clearInterval(this.interval);
    } catch (e) {
      console.error("failed to shutdown app service");
    }
  }
}

@Module({
  imports: [
    KafkaModule.forRoot({
      /*consumer: {
        conf: {
          "bootstrap.servers": "localhost:9092",
          "group.id": "example-standalone-group",
        },
      },*/
      producer: {
        conf: {
          "bootstrap.servers": "localhost:9092",
          "api.version.request.timeout.ms": 1000,
          retries: 0,
        },
      },
      adminClient: {
        conf: {
          "bootstrap.servers": "localhost:9092",
          "socket.connection.setup.timeout.ms": 1000,
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
