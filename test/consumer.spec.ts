import { KafkaJS } from "@confluentinc/kafka-javascript";
import { Test } from "@nestjs/testing";
import { KAFKA_CONSUMER_PROVIDER, KafkaModule } from "../src";

describe("App start if the consumer can't connect and autoConnect=false", () => {
  let app;

  it("should not throw an exception", async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          consumer: {
            autoConnect: false,
            conf: {
              "group.id": "group.id",
              "metadata.broker.list": "127.0.0.1:9999",
            },
          },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("should mock app defined", async () => {
    expect(app).toBeDefined();
  });
});

describe("App doesn't start if the consumer can't connect and autoConnect=true", () => {
  it("should throw an exception", async () => {
    const module = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          consumer: {
            autoConnect: true,
            conf: {
              "group.id": "group.id",
              "metadata.broker.list": "127.0.0.1:9999",
            },
          },
        }),
      ],
    }).compile();

    const app = module.createNestApplication();

    const fn = async () => {
      await app.init();
    };

    await expect(fn()).rejects.toThrow("Local: Broker transport failure");
  });
});

describe("App fail fast if the consumer can't connect, autoConnect=false and timeout is low", () => {
  it("should throw an exception", async () => {
    const fn = async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [
          KafkaModule.forRoot({
            consumer: {
              autoConnect: false,
              conf: {
                "group.id": "group.id",
                "metadata.broker.list": "127.0.0.1:9999",
              },
            },
          }),
        ],
      }).compile();

      const app = moduleFixture.createNestApplication();
      await app.init();

      const consumer: KafkaJS.Consumer = app.get(KAFKA_CONSUMER_PROVIDER);

      await consumer.connect();
    };

    await expect(fn()).rejects.toThrow("Local: Broker transport failure");
  });
});
