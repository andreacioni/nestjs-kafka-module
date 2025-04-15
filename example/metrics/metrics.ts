import { KafkaJS } from "@confluentinc/kafka-javascript";
import { EachMessagePayload } from "@confluentinc/kafka-javascript/types/kafkajs";
import {
  Controller,
  Get,
  HttpException,
  Inject,
  Module,
  OnModuleInit,
  Query,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  KAFKA_ADMIN_CLIENT_PROVIDER,
  KAFKA_CONSUMER_PROVIDER,
  KAFKA_PRODUCER_PROVIDER,
  KafkaModule,
} from "../../src/index";

@Controller("metrics")
class MetricsController {
  constructor(
    @Inject(KAFKA_ADMIN_CLIENT_PROVIDER) private readonly admin: KafkaJS.Admin,
    @Inject(KAFKA_CONSUMER_PROVIDER) private readonly consumer: KafkaJS.Consumer
  ) {}

  @Get()
  async metrics() {
    // Step 1: Fetch producer offsets
    const producerOffset = await this.admin.fetchTopicOffsets("DEMO_TOPIC");

    // Step 2: Fetch consumer offsets for the group
    const consumerOffsets = await this.admin.fetchOffsets({
      groupId: "nestjs-rdkafka-test",
      topics: ["DEMO_TOPIC"],
    });

    const consumerMetrics = {};
    consumerOffsets.forEach((offset) => {
      consumerMetrics[offset.topic] = offset.partitions.reduce(
        (prev, curr) => Math.max(prev, Number.parseInt(curr.offset)),
        0
      );
    });

    const producerMetrics = {};
    producerOffset.forEach((offset) => {
      producerMetrics["DEMO_TOPIC"] = Number.parseInt(offset.offset);
    });

    const lag = {};

    Object.keys(consumerMetrics).forEach((topic) => {
      lag[topic] = producerMetrics[topic] - consumerMetrics[topic];
    });
    return { producerMetrics, consumerMetrics, lag };
  }
}

class AppService implements OnModuleInit {
  private readonly queue: EachMessagePayload[] = [];
  constructor(
    @Inject(KAFKA_CONSUMER_PROVIDER)
    private readonly consumer: KafkaJS.Consumer,
    @Inject(KAFKA_PRODUCER_PROVIDER)
    private readonly producer: KafkaJS.Producer
  ) {}

  async onModuleInit() {
    await this.consumer.subscribe({
      topics: ["DEMO_TOPIC"],
    });

    return this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        console.log(
          "message received: %s, queue length: %d",
          payload.message.value?.toString(),
          this.queue.length
        );
        this.queue.push(payload);
      },
    });
  }

  public async consumeSingleMessage(): Promise<string> {
    const { message, topic, partition } = this.queue.shift() ?? {};
    if (!message || !topic || partition === undefined) {
      console.log("no message in topic");
      throw new HttpException("no message in topic", 404);
    }
    this.consumer.commitOffsets([
      {
        topic: topic,
        partition: partition,
        offset: (Number.parseInt(message.offset) + 1).toString(),
      },
    ]);
    return message.value?.toString() ?? "";
  }

  public async produceMessage(message: string): Promise<void> {
    const res = await this.producer.send({
      topic: "DEMO_TOPIC",
      messages: [{ value: message }],
    });
    for (const record of res) {
      if (record.errorCode !== 0) {
        throw new Error("error sending message: " + record.errorCode);
      }
      console.log("message sent");
    }
  }
}

@Controller("app")
class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("produce")
  async produce(@Query("message") message: string) {
    await this.appService.produceMessage(message);
  }
  @Get("consume")
  async consume(): Promise<string> {
    return (await this.appService.consumeSingleMessage()) ?? "";
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
        },
      },
      adminClient: { conf: { "bootstrap.servers": "127.0.0.1:9092" } },
    }),
  ],
  providers: [AppService],
  controllers: [MetricsController, AppController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.enableShutdownHooks().listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
