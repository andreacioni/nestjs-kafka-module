import { KafkaJS } from "@confluentinc/kafka-javascript";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NestApplication } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { setTimeout as timeout } from "node:timers/promises";
import { StartedDockerComposeEnvironment } from "testcontainers";
import { KafkaModule } from "../src";
import {
  KAFKA_ADMIN_CLIENT_PROVIDER,
  KAFKA_CONSUMER_PROVIDER,
  KAFKA_PRODUCER_PROVIDER,
} from "../src/kafka/providers/kafka.connection";
import { startTestCompose, stopTestCompose } from "./testcontainers-utils";

const createTopic = async (admin: KafkaJS.Admin) => {
  await admin.createTopics({
    topics: [
      {
        numPartitions: 1,
        replicationFactor: 1,
        topic: "test_topic",
      },
    ],
  });
};

const deleteTopic = async (admin: KafkaJS.Admin) => {
  await admin.deleteTopics({ topics: ["test_topic"] });
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
    await stopTestCompose(startedContainer);
  });

  it("should mock app defined", async () => {
    expect(app).toBeDefined();
  });
});

describe("App produce and consume message asynchronously", () => {
  let app: NestApplication;
  let admin: KafkaJS.Admin;
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
          producer: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
          adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);

    await createTopic(admin);
  });

  afterAll(async () => {
    await app?.close();
    await stopTestCompose(startedContainer);
  });

  it("should produce and consume 2 messages (asynchronously)", async () => {
    expect(app).toBeDefined();

    const consumer: KafkaJS.Consumer = app.get(KAFKA_CONSUMER_PROVIDER);
    const producer: KafkaJS.Producer = app.get(KAFKA_PRODUCER_PROVIDER);

    const consumerFn = jest.fn();

    await consumer.subscribe({ topics: ["test_topic"] });
    consumer.seek({ topic: "test_topic", partition: 0, offset: "0" });
    consumer.run({
      eachMessage: async ({ message }) => {
        consumerFn(message);
      },
    });

    //await internal consumer thread to spawn
    //this delay ensures that the consumer is going read from offset 0
    await timeout(1000);

    await producer.send({
      topic: "test_topic",
      messages: [{ value: "Hello" }],
    });
    await producer.send({
      topic: "test_topic",
      messages: [{ value: "Goodbye" }],
    });
    await producer.flush();

    await timeout(5000);

    expect(consumerFn).toHaveBeenCalledTimes(2);
  });
});

describe("App produce and consume message synchronously", () => {
  let app: NestApplication;
  let admin: KafkaJS.Admin;
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
          producer: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
          adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
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
      await app?.close();
      //await deleteTopic(admin);
    } finally {
      await stopTestCompose(startedContainer);
    }
  });

  it("should produce and consume 2 messages (synchronously)", async () => {
    expect(app).toBeDefined();

    const consumer: KafkaJS.Consumer = app.get(KAFKA_CONSUMER_PROVIDER);
    const producer: KafkaJS.Producer = app.get(KAFKA_PRODUCER_PROVIDER);

    expect(admin).toBeDefined();

    const consumerFn = jest.fn();

    await producer.send({
      topic: "test_topic",
      messages: [{ value: "Hello" }],
    });
    await producer.send({
      topic: "test_topic",
      messages: [{ value: "Goodbye" }],
    });

    await producer.flush({ timeout: 2000 });
    await consumer.subscribe({ topics: ["test_topic"] });
    consumer.seek({ topic: "test_topic", partition: 0, offset: "0" });
    await new Promise<void>((resolve) => {
      let count = 0;
      const timeoutId = setTimeout(() => {
        resolve(); // Resolve the promise after 5 seconds if not already resolved
      }, 5000);

      consumer.run({
        eachMessage: async ({ message }) => {
          if (count++ === 2) {
            clearTimeout(timeoutId);
            resolve();
          }
          consumerFn(message);
        },
      });
    });

    expect(consumerFn).toHaveBeenCalledTimes(2);
  });
});

describe("App produce and consume message with auto connect disabled", () => {
  let app: NestApplication;
  let admin: KafkaJS.Admin;
  let consumer: KafkaJS.Consumer;
  let producer: KafkaJS.Producer;

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
          adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);
    consumer = app.get(KAFKA_CONSUMER_PROVIDER);
    producer = app.get(KAFKA_PRODUCER_PROVIDER);

    await producer.connect();
    await consumer.connect();

    await createTopic(admin);
  });

  afterAll(async () => {
    try {
      await producer.flush();
      await producer.disconnect();
      await consumer.disconnect();
      await deleteTopic(admin);
      admin.disconnect();
    } finally {
      await stopTestCompose(startedContainer);
    }
  });

  it("should produce and consume 2 messages, auto connect = false", async () => {
    expect(app).toBeDefined();

    expect(admin).toBeDefined();

    const consumerFn = jest.fn();

    await consumer.subscribe({ topics: ["test_topic"] });
    consumer.seek({ topic: "test_topic", partition: 0, offset: "0" });
    await consumer.run({
      eachMessage: async ({ message }) => {
        consumerFn(message);
      },
    });

    await producer.send({
      topic: "test_topic",
      messages: [{ value: "Hello" }],
    });
    await producer.send({
      topic: "test_topic",
      messages: [{ value: "Goodbye" }],
    });
    await producer.flush({ timeout: 2000 });

    await timeout(5000);

    expect(consumerFn).toHaveBeenCalledTimes(2);
  });
});

describe("Test call getMetadata", () => {
  let app: NestApplication;
  let consumer: KafkaJS.Consumer;
  let admin: KafkaJS.Admin;
  let producer: KafkaJS.Producer;
  let getMetadata: () => Promise<{ topics: KafkaJS.ITopicMetadata[] }>;

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
              "bootstrap.servers": "localhost:9092",
            },
          },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    consumer = app.get(KAFKA_CONSUMER_PROVIDER);
    producer = app.get(KAFKA_PRODUCER_PROVIDER);
    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);

    await producer.connect();
    await consumer.connect();

    await admin.createTopics({
      topics: [
        {
          numPartitions: 1,
          replicationFactor: 1,
          topic: "test_topic",
        },
      ],
    });

    getMetadata = async () => {
      return await admin.fetchTopicMetadata({
        timeout: 1000,
      });
    };
  });

  afterAll(async () => {
    try {
      let promises: Promise<void>[] = [];
      promises.push(admin.disconnect());
      promises.push(consumer.disconnect());
      promises.push(producer.disconnect());
      await Promise.all(promises);
    } finally {
      await stopTestCompose(startedContainer);
    }
  });

  it("get metadata not throw anything when connected", async () => {
    expect(app).toBeDefined();

    await expect(async () => getMetadata()).not.toThrow();
  });

  it("get metadata not throw when consumer is not connected (client calls disconnect)", async () => {
    expect(app).toBeDefined();

    await expect(getMetadata()).resolves.toBeDefined();

    await consumer.disconnect();

    await expect(getMetadata()).resolves.toBeDefined();
  });

  it("get metadata not throw when admin is not connected (client calls disconnect)", async () => {
    expect(app).toBeDefined();

    await expect(getMetadata()).resolves.toBeDefined();

    await admin.disconnect();

    await expect(getMetadata()).rejects.toThrow(
      "Admin client is not connected"
    );
  });
});

describe("Test call getMetadata when the broker has crashed", () => {
  let app: NestApplication;
  let consumer: KafkaJS.Consumer;
  let admin: KafkaJS.Admin;
  let producer: KafkaJS.Producer;
  let getMetadata: () => Promise<{ topics: KafkaJS.ITopicMetadata[] }>;

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
              "bootstrap.servers": "localhost:9092",
            },
          },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    consumer = app.get(KAFKA_CONSUMER_PROVIDER);
    producer = app.get(KAFKA_PRODUCER_PROVIDER);
    admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);

    await producer.connect();
    await consumer.connect();

    await admin.createTopics({
      topics: [
        {
          numPartitions: 1,
          replicationFactor: 1,
          topic: "test_topic",
        },
      ],
    });

    getMetadata = async () => {
      return await admin.fetchTopicMetadata({ timeout: 1000 });
    };
  });

  afterAll(async () => {
    let promises: Promise<void>[] = [];
    promises.push(admin.disconnect());
    promises.push(consumer.disconnect());
    promises.push(producer.disconnect());
    await Promise.all(promises);
  });

  it("get metadata not throw error when admins is not connected (broker fails)", async () => {
    expect(app).toBeDefined();

    await expect(getMetadata()).resolves.toBeDefined();

    await stopTestCompose(startedContainer);

    await expect(getMetadata()).rejects.toThrow(
      "Local: Broker transport failure"
    );
  });
});
