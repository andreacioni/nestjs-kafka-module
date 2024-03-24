import {
  Inject,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IAdminClient, KafkaConsumer, Producer } from "node-rdkafka";
import { KafkaModule } from "../src/kafka/kafka.module";
import { KAFKA_ADMIN_CLIENT_PROVIDER } from "../src/kafka/providers/kafka.connection";

import { promisify } from "node:util";

class AppService implements OnApplicationBootstrap, OnApplicationShutdown {
  private interval: NodeJS.Timeout;

  constructor(
    private readonly consumer: KafkaConsumer,
    private readonly producer: Producer,
    @Inject(KAFKA_ADMIN_CLIENT_PROVIDER) private readonly admin: IAdminClient
  ) {}
  async onApplicationBootstrap() {
    //CONSUMER
    this.consumer.subscribe(["DEMO_TOPIC"]);
    this.consumer.on("data", (message) => {
      console.log("message received: %s", message.value);
    });
    this.consumer.consume();

    //PRODUCE
    let i = 0;
    this.interval = setInterval(() => {
      const msg = Buffer.from((i++).toString());
      this.producer.produce("DEMO_TOPIC", null, msg);
      console.log("message sent: %s", msg);
    }, 1000);
  }
  async onApplicationShutdown(signal?: string) {
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
        autoConnect: false,
        conf: {
          "group.id": "nestjs-rdkafka-test",
          "metadata.broker.list": "127.0.0.1:9092",
        },
      },
      producer: {
        autoConnect: false,
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

  app.enableShutdownHooks();

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
