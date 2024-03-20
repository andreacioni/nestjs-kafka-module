import { ConfigModule, ConfigService } from "@nestjs/config";
import { NestApplication } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { IAdminClient, KafkaConsumer, Producer } from "node-rdkafka";
import { setTimeout } from "node:timers/promises";
import { StartedDockerComposeEnvironment } from "testcontainers";
import { KafkaModule } from "../src";
import { KAFKA_ADMIN_CLIENT_PROVIDER } from "../src/kafka/providers/kafka.connection";
import {
  consumerConnect,
  consumerDisconnect,
  producerConnect,
  producerDisconnect,
} from "../src/kafka/utils/kafka.utils";
import { startTestCompose, stopTestCompose } from "./testcontainers-utils";

const createTopic = async (admin: IAdminClient) => {
  await new Promise<void>((resolve, reject) => {
    admin.createTopic(
      {
        num_partitions: 1,
        replication_factor: 1,
        topic: "test_topic",
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

const deleteTopic = async (admin: IAdminClient) => {
  await new Promise<void>((resolve, reject) => {
    admin.deleteTopic("test_topic", (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

describe("App consuming KafkaModule build with forRootAsync", () => {
  let app: NestApplication;
  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forFeature(() => ({
          host: "127.0.0.1:9092",
          groupId: "nestjs-rdkafka-test",
          securityProtocol: "plaintext",
        })),
        KafkaModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            return {
              consumer: {
                conf: {
                  "metadata.broker.list": config.get("host"),
                  "security.protocol": config.get("securityProtocol"),
                  "group.id": config.get("groupId"),
                },
              },
              adminClient: {
                conf: {
                  "metadata.broker.list": config.get("host"),
                  "security.protocol": config.get("securityProtocol"),
                },
              },
              producer: {
                conf: {
                  "metadata.broker.list": config.get("host"),
                  "security.protocol": config.get("securityProtocol"),
                },
              },
            };
          },
          imports: [ConfigModule],
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    //await app?.get(KafkaService).disconnect();
    await stopTestCompose(startedContainer);
  });

  it("should mock app defined", async () => {
    expect(app).toBeDefined();
  });
});

describe("App produce and consume message asynchronously", () => {
  let app: NestApplication;
  let admin: IAdminClient;
  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();

    const moduleFixture = await Test.createTestingModule({
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
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);

    await createTopic(admin);
  });

  afterAll(async () => {
    await deleteTopic(admin);
    await app?.close();
    await stopTestCompose(startedContainer);
  });

  it("should produce and consume 2 messages (asynchronously)", async () => {
    expect(app).toBeDefined();

    const consumer = app.get(KafkaConsumer);
    const producer = app.get(Producer);

    expect(consumer.isConnected()).toBe(true);
    expect(producer.isConnected()).toBe(true);
    expect(admin).toBeDefined();

    const consumerFn = jest.fn();

    consumer.on("data", consumerFn);
    consumer.subscribe(["test_topic"]);
    consumer.consume();

    //await internal consumer thread to spawn
    //this delay ensures that the consumer is going read from offset 0
    await setTimeout(1000);

    producer.produce("test_topic", null, Buffer.from("Hello"));
    producer.produce("test_topic", null, Buffer.from("Goodbye"));
    producer.flush();

    await setTimeout(1000);

    expect(consumerFn).toHaveBeenCalledTimes(2);
  });
});
describe("App produce and consume message synchronously", () => {
  let app: NestApplication;
  let admin: IAdminClient;
  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();

    const moduleFixture = await Test.createTestingModule({
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
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);

    await createTopic(admin);
  });

  afterAll(async () => {
    try {
      await deleteTopic(admin);
      await app?.close();
    } finally {
      await stopTestCompose(startedContainer);
    }
  });

  it("should produce and consume 2 messages (synchronously)", async () => {
    expect(app).toBeDefined();

    const consumer = app.get(KafkaConsumer);
    const producer = app.get(Producer);

    expect(consumer.isConnected()).toBe(true);
    expect(producer.isConnected()).toBe(true);
    expect(admin).toBeDefined();

    const consumerFn = jest.fn();

    consumer.subscribe(["test_topic"]);

    //consume 0 messages to ensure that the consumer is going read from offset 0
    await new Promise<void>((resolve, reject) => {
      consumer.consume(1, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    producer.produce("test_topic", null, Buffer.from("Hello"));
    producer.produce("test_topic", null, Buffer.from("Goodbye"));

    await new Promise<void>((resolve, reject) => {
      producer.flush(2000, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      consumer.consume(2, async (err, msg) => {
        if (err) {
          reject(err);
        } else {
          for (const m of msg) {
            consumerFn(m);
          }
          resolve();
        }
      });
    });

    expect(consumerFn).toHaveBeenCalledTimes(2);

    consumer.unsubscribe();
  });
});

describe("App produce and consume message with auto connect disabled", () => {
  let app: NestApplication;
  let admin: IAdminClient;
  let consumer: KafkaConsumer;
  let producer: Producer;

  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          consumer: {
            autoConnect: false,
            conf: {
              "metadata.broker.list": "localhost:9092",
              "group.id": "groupid123",
            },
          },
          producer: {
            autoConnect: false,
            conf: {
              "client.id": "kafka-mocha",
              "metadata.broker.list": "localhost:9092",
            },
          },
          adminClient: {
            conf: {
              "metadata.broker.list": "127.0.0.1:9092",
            },
          },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);
    consumer = app.get(KafkaConsumer);
    producer = app.get(Producer);

    await producerConnect(producer);
    await consumerConnect(consumer);

    await createTopic(admin);
  });

  afterAll(async () => {
    try {
      await deleteTopic(admin);
      await producerDisconnect(producer);
      await consumerDisconnect(consumer);
    } finally {
      await stopTestCompose(startedContainer);
    }
  });

  it("should produce and consume 2 messages, auto connect = false", async () => {
    expect(app).toBeDefined();

    expect(consumer.isConnected()).toBe(true);
    expect(producer.isConnected()).toBe(true);
    expect(admin).toBeDefined();

    const consumerFn = jest.fn();

    consumer.subscribe(["test_topic"]);

    //consume 0 messages to ensure that the consumer is going read from offset 0
    await new Promise<void>((resolve, reject) => {
      consumer.consume(1, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    producer.produce("test_topic", null, Buffer.from("Hello"));
    producer.produce("test_topic", null, Buffer.from("Goodbye"));

    await new Promise<void>((resolve, reject) => {
      producer.flush(2000, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      consumer.consume(2, async (err, msg) => {
        if (err) {
          reject(err);
        } else {
          for (const m of msg) {
            consumerFn(m);
          }
          resolve();
        }
      });
    });

    expect(consumerFn).toHaveBeenCalledTimes(2);

    consumer.unsubscribe();
  });
});
