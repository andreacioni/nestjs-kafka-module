import { KafkaJS, NewTopic } from "@confluentinc/kafka-javascript";
import { NestApplication } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { StartedDockerComposeEnvironment } from "testcontainers";
import { KafkaModule } from "../src";
import { KAFKA_ADMIN_CLIENT_PROVIDER } from "../src/kafka/providers/kafka.connection";
import { startTestCompose, stopTestCompose } from "./testcontainers-utils";

describe("App start and stop even if the admin client is not reachable", () => {
  let app;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9999" } },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    app.close();
  });

  it("should mock app defined", async () => {
    expect(app).toBeDefined();
  });
});

describe("Test admin client instance", () => {
  let app: NestApplication;
  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    app?.close();
    await stopTestCompose(startedContainer);
  });

  it("should create and delete a topic", async () => {
    expect(app).toBeDefined();
    const adminClient: KafkaJS.Admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);
    const newTopic: NewTopic = {
      topic: "new_topic",
      num_partitions: 1,
      replication_factor: 1,
    };

    const createPromise = adminClient.createTopics({ topics: [newTopic] });

    await expect(createPromise).resolves.not.toThrow();

    const deletePromise = adminClient.deleteTopics({
      topics: [newTopic.topic],
    });

    await expect(deletePromise).resolves.not.toThrow();
  });

  it("should fail to delete topic if it is not defined ", async () => {
    expect(app).toBeDefined();

    const adminClient: KafkaJS.Admin = app.get(KAFKA_ADMIN_CLIENT_PROVIDER);

    const deletePromise = adminClient.deleteTopics({ topics: ["new_topic"] });

    await expect(deletePromise).rejects.toThrow(
      "Broker: Unknown topic or partition"
    );
  });
});
