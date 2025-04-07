import { SchemaRegistryClient } from "@confluentinc/schemaregistry";
import { Test } from "@nestjs/testing";
import { StartedDockerComposeEnvironment } from "testcontainers";
import { KafkaModule } from "../src";
import { startTestCompose, stopTestCompose } from "./testcontainers-utils";

describe("AVRO message produce and consume", () => {
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
    app?.close();
    await stopTestCompose(startedContainer);
  });

  it("should have schema registry defined", async () => {
    const schemaRegistry: SchemaRegistryClient = app.get(SchemaRegistryClient);
    expect(schemaRegistry).toBeDefined();
    expect(schemaRegistry).toBeInstanceOf(SchemaRegistryClient);
  });

  it("should produce and consume AVRO message", async () => {
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
