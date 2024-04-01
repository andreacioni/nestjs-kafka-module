import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { KAFKA_ADMIN_CLIENT_PROVIDER, KafkaModule } from "nestjs-kafka-module";
import { IAdminClient, KafkaConsumer, Producer } from "node-rdkafka";
import * as request from "supertest";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication;
  let consumer: KafkaConsumer;
  let producer: Producer;
  let adminClient: IAdminClient;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    producer = app.get<Producer>(Producer);
    consumer = app.get<KafkaConsumer>(KafkaConsumer);
    adminClient = app.get<IAdminClient>(KAFKA_ADMIN_CLIENT_PROVIDER);
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect("Hello World!");
  });

  it('should be defined"', () => {
    expect(consumer).toBeDefined();
    expect(producer).toBeDefined();
    expect(adminClient).toBeDefined();
  });
});
