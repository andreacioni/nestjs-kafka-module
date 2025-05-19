import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Test, TestingModule } from "@nestjs/testing";
import {
  KAFKA_ADMIN_CLIENT_TOKEN,
  KAFKA_CONSUMER_TOKEN,
  KAFKA_PRODUCER_TOKEN,
  KafkaModule,
} from "nestjs-kafka-module";
import { AppController } from "./app.controller";
import { AppModule } from "./app.module";
import { AppService } from "./app.service";

describe("KafkaModule", () => {
  let consumer: KafkaJS.Consumer;
  let producer: KafkaJS.Producer;
  let adminClient: KafkaJS.Admin;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        KafkaModule.forRoot({
          autoConnect: false,
          consumer: {
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
            autoConnect: false,
            conf: {
              "metadata.broker.list": "127.0.0.1:9092",
            },
          },
        }),
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    producer = app.get<KafkaJS.Producer>(KAFKA_PRODUCER_TOKEN);
    consumer = app.get<KafkaJS.Consumer>(KAFKA_CONSUMER_TOKEN);
    adminClient = app.get<KafkaJS.Admin>(KAFKA_ADMIN_CLIENT_TOKEN);
  });

  describe("Kafka instances", () => {
    it('should be defined"', () => {
      expect(consumer).toBeDefined();
      expect(producer).toBeDefined();
      expect(adminClient).toBeDefined();
    });
  });
});
