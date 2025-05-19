import { KafkaJS, NewTopic } from "@confluentinc/kafka-javascript";
import { INestApplication } from "@nestjs/common";
import { NestApplication } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { StartedDockerComposeEnvironment } from "testcontainers";
import { KafkaModule } from "../src";
import {
  KAFKA_ADMIN_CLIENT_TOKEN,
  KAFKA_HEALTH_INDICATOR_TOKEN,
} from "../src/kafka/providers/kafka.connection";
import { KafkaHealthIndicator } from "../src/kafka/providers/kafka.health";
import { startTestCompose, stopTestCompose } from "./testcontainers-utils";

describe("App start and stop even if the admin client is not reachable", () => {
  let app: INestApplication;

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
    await app.close();
  });

  it("should mock app defined", async () => {
    expect(app).toBeDefined();
  });
});

describe("Test admin client instance (Testcontainers wrapper)", () => {
  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();
  });

  afterAll(async () => {
    await stopTestCompose(startedContainer);
  });

  describe("Test admin client instance", () => {
    let app: NestApplication;
    beforeAll(async () => {
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
      await app?.close();
    });

    it("should create and delete a topic", async () => {
      expect(app).toBeDefined();
      const adminClient: KafkaJS.Admin = app.get(KAFKA_ADMIN_CLIENT_TOKEN);
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

      const adminClient: KafkaJS.Admin = app.get(KAFKA_ADMIN_CLIENT_TOKEN);

      const deletePromise = adminClient.deleteTopics({ topics: ["new_topic"] });

      await expect(deletePromise).rejects.toThrow(
        "Broker: Unknown topic or partition"
      );
    });
  });

  describe("Test the availability of KafkaClientIndicator in different situations", () => {
    let app: INestApplication | null;
    afterEach(async () => {
      await app?.close();
      app = null;
    });
    it("should have indicator defined but to throw because TerminusModule is not available", async () => {
      jest.mock("@nestjs/terminus", () => {
        throw new Error();
      });
      const moduleFixture = await Test.createTestingModule({
        imports: [
          KafkaModule.forRoot({
            adminClient: { conf: { "metadata.broker.list": "127.0.0.1:9092" } },
          }),
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      expect(app).toBeDefined();

      const adminClient: KafkaJS.Admin = app.get(KAFKA_ADMIN_CLIENT_TOKEN);
      expect(adminClient).toBeDefined();

      expect(app.get(KafkaHealthIndicator)).toBeDefined();
      expect(app.get(KAFKA_HEALTH_INDICATOR_TOKEN)).toBeDefined();

      const indicator: KafkaHealthIndicator = app.get(
        KAFKA_HEALTH_INDICATOR_TOKEN
      );

      await expect(indicator.isHealty()).rejects.toThrow(
        "Kafka admin client not provided. Did you forget to inject TerminusModule?"
      );
    });

    it("should have indicator defined even if adminClient config is not defined", async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [KafkaModule.forRoot({})],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      expect(app).toBeDefined();

      const adminClient: KafkaJS.Admin = app.get(KAFKA_ADMIN_CLIENT_TOKEN);
      expect(adminClient).not.toBeDefined();

      expect(() => app!.get(KafkaHealthIndicator)).not.toThrow();
      expect(() => app!.get(KAFKA_HEALTH_INDICATOR_TOKEN)).not.toThrow(
        "Nest could not find KafkaHealthIndicator element (this provider does not exist in the current context)"
      );
    });
  });
});
