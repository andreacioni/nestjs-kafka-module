import { SchemaRegistryClient } from "@confluentinc/schemaregistry";
import { Test } from "@nestjs/testing";
import { StartedDockerComposeEnvironment } from "testcontainers";
import {
  KAFKA_ADMIN_CLIENT_PROVIDER,
  KAFKA_CONSUMER_PROVIDER,
  KAFKA_PRODUCER_PROVIDER,
  KafkaModule,
} from "../src";
import { startTestCompose, stopTestCompose } from "./testcontainers-utils";

describe("Schema registry connection and schema download", () => {
  let app;

  let startedContainer: StartedDockerComposeEnvironment;

  beforeAll(async () => {
    startedContainer = await startTestCompose();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        KafkaModule.forRoot({
          schemaRegistry: { conf: { baseURLs: ["http://localhost:8081"] } },
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

  it("should SchemaRegistryClient be defined", async () => {
    const schemaRegistry = app.get(SchemaRegistryClient);
    expect(schemaRegistry).toBeDefined();
  });

  it("should KafkaProducer, AdminClient, Consumer not be defined", async () => {
    const producer = app.get(KAFKA_PRODUCER_PROVIDER, { strict: false });
    const consumer = app.get(KAFKA_CONSUMER_PROVIDER, { strict: false });
    const adminClient = app.get(KAFKA_ADMIN_CLIENT_PROVIDER, { strict: false });

    expect(producer).toBeUndefined();
    expect(adminClient).toBeUndefined();
    expect(consumer).toBeUndefined();
  });

  it("should create an AVRO schema and delete it", async () => {
    const registry: SchemaRegistryClient = app.get(SchemaRegistryClient);
    const subject = "test";
    const schema = {
      type: "record",
      namespace: "examples",
      name: "RandomTest",
      fields: [{ name: "fullName", type: "string" }],
    };
    const id = await registry.register(subject, {
      schemaType: "AVRO",
      schema: JSON.stringify(schema),
    });
    expect(id).toBeDefined();

    registry.getBySubjectAndId(subject, id).then((response) => {
      expect(response).toBeDefined();
      expect(JSON.parse(response.schema)).toEqual(schema);
    });

    registry.deleteSubject(subject).then((response) => {
      expect(response).toBeDefined();
      expect(response).toEqual([id]);
    });
  });
});
