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
  Res,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  InjectMetric,
  makeGaugeProvider,
  PrometheusController,
  PrometheusModule,
} from "@willsoto/nestjs-prometheus";
import { Gauge } from "prom-client";
import {
  KAFKA_CONSUMER_TOKEN,
  KAFKA_PRODUCER_TOKEN,
  KafkaMetricsService,
  KafkaModule,
} from "../../src/index";

@Controller("metrics")
class MetricsController extends PrometheusController {
  constructor(
    @Inject(KAFKA_METRICS_TOKEN)
    private readonly kafkaMetrics: KafkaMetricsService,
    @InjectMetric("kafka_consumer_offset")
    public consumerOffsetGauge: Gauge<string>,
    @InjectMetric("kafka_producer_offset")
    public producerOffsetGauge: Gauge<string>,
    @InjectMetric("kafka_consumer_lag") public lagGauge: Gauge<string>
  ) {
    super();
  }

  @Get()
  async index(@Res({ passthrough: true }) response: Response) {
    const metrics = await this.kafkaMetrics.getMetrics();
    for (const topic in metrics) {
      const { lag, consumerOffset, producerOffset } = metrics[topic];
      this.consumerOffsetGauge.set({ topic }, consumerOffset ?? 0);
      this.producerOffsetGauge.set({ topic }, producerOffset ?? 0);
      this.lagGauge.set({ topic }, lag ?? 0);
    }

    return super.index(response);
  }
}

class AppService implements OnModuleInit {
  private readonly queue: EachMessagePayload[] = [];
  constructor(
    @Inject(KAFKA_CONSUMER_TOKEN)
    private readonly consumer: KafkaJS.Consumer,
    @Inject(KAFKA_PRODUCER_TOKEN)
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
    PrometheusModule.register(),
  ],
  providers: [
    AppService,
    makeGaugeProvider({
      name: "kafka_consumer_lag",
      help: "This is the lag of current process consumer group.",
      labelNames: ["topic"],
    }),
    makeGaugeProvider({
      name: "kafka_consumer_offset",
      help: "This is the offset of current process consumer group.",
      labelNames: ["topic"],
    }),
    makeGaugeProvider({
      name: "kafka_producer_offset",
      help: "This is the offset of the latest message sent to the broker.",
      labelNames: ["topic"],
    }),
  ],
  controllers: [MetricsController, AppController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.enableShutdownHooks().listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
