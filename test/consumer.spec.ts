import { KafkaConsumer } from "@confluentinc/kafka-javascript";
import { Test } from "@nestjs/testing";
import { KafkaModule } from "../src";

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
            metadataConf: { timeout: 1 },
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
            metadataConf: { timeout: 1 },
          },
        }),
      ],
    }).compile();

    const app = module.createNestApplication();

    const fn = async () => {
      await app.init();
    };

    await expect(fn()).rejects.toThrow("Broker transport failure");
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

      const consumer = app.get(KafkaConsumer);

      await new Promise<void>((resolve, reject) => {
        consumer.connect({ timeout: 1 }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    };

    await expect(fn()).rejects.toThrow("Broker transport failure");
  });
});
