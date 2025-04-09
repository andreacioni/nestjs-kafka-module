import {
  DockerComposeEnvironment,
  GenericContainer,
  StartedDockerComposeEnvironment,
  StartedTestContainer,
} from "testcontainers";

export const startTestCompose = async (
  ...profiles: string[]
): Promise<StartedDockerComposeEnvironment> => {
  const environment = new DockerComposeEnvironment(".", "docker-compose.yml");
  environment.withProfiles(...profiles);
  const ret = await environment.up();
  return ret;
};

export const stopTestCompose = async (
  startedContainer: StartedDockerComposeEnvironment
): Promise<void> => {
  await startedContainer.down();
};

export const startTestContainer = async (): Promise<StartedTestContainer> => {
  const ret = new GenericContainer("confluentinc/cp-kafka:7.5.3")
    .withExposedPorts({ container: 9092, host: 9092 })
    .withEnvironment({
      KAFKA_NODE_ID: "1",
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP:
        "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT",
      KAFKA_ADVERTISED_LISTENERS:
        "PLAINTEXT://localhost:29092,PLAINTEXT_HOST://localhost:9092",
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1",
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0",
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1",
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1",
      KAFKA_PROCESS_ROLES: "broker,controller",
      KAFKA_CONTROLLER_QUORUM_VOTERS: "1@localhost:29093",
      KAFKA_LISTENERS:
        "PLAINTEXT://localhost:29092,CONTROLLER://localhost:29093,PLAINTEXT_HOST://0.0.0.0:9092",
      KAFKA_INTER_BROKER_LISTENER_NAME: "PLAINTEXT",
      KAFKA_CONTROLLER_LISTENER_NAMES: "CONTROLLER",
      KAFKA_LOG_DIRS: "/tmp/kraft-combined-logs",
      CLUSTER_ID: "MkU3OEVBNTcwNTJENDM2Qk",
    })
    .start();
  return await ret;
};

export const stopTestContainer = async (
  startedContainer: StartedTestContainer
): Promise<void> => {
  await startedContainer.stop();
};
