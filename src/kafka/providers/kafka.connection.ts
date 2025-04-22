import { KafkaJS } from "@confluentinc/kafka-javascript";
import { SchemaRegistryClient } from "@confluentinc/schemaregistry";
import { DynamicModule, Provider } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { KafkaAdminClientOptions } from "../interfaces/kafka-admin-client-options";
import {
  KafkaConnectionAsyncOptions,
  KafkaConnectionOptions,
} from "../interfaces/kafka-connection-options";
import { KafkaConsumerOptions } from "../interfaces/kafka-consumer-options";
import { KafkaProducerOptions } from "../interfaces/kafka-producer-options";
import { KafkaSchemaRegistryClientOptions } from "../interfaces/kafka-schema-registry-options";
import { KafkaHealthIndicator } from "./kafka.health";
import { KafkaMetricsService } from "./kafka.metrics";

export const KAFKA_ADMIN_CLIENT_TOKEN = "KAFKA_ADMIN_CLIENT";
export const KAFKA_PRODUCER_TOKEN = "KAFKA_PRODUCER";
export const KAFKA_CONSUMER_TOKEN = "KAFKA_CONSUMER";
export const KAFKA_CONFIGURATION_TOKEN = "KAFKA_CONFIGURATION";
export const KAFKA_SCHEMA_REGISTRY_TOKEN = SchemaRegistryClient;
export const KAFKA_HEALTH_INDICATOR_TOKEN = KafkaHealthIndicator;
export const KAFKA_METRICS_TOKEN = KafkaMetricsService;

function createConsumer(
  consumerOptions: KafkaConsumerOptions
): KafkaJS.Consumer {
  const consumer = new KafkaJS.Kafka({}).consumer(consumerOptions.conf);

  return consumer;
}

function createProducer(
  producerOptions: KafkaProducerOptions
): KafkaJS.Producer {
  const producer = new KafkaJS.Kafka({}).producer(producerOptions.conf);
  return producer;
}

function createAdminClient(options: KafkaAdminClientOptions): KafkaJS.Admin {
  return new KafkaJS.Kafka({}).admin(options.conf);
}

function createSchemaRegistry(
  options: KafkaSchemaRegistryClientOptions
): SchemaRegistryClient {
  return new SchemaRegistryClient(options.conf);
}

export function getKafkaConnectionProviderList(
  options: KafkaConnectionOptions,
  pluginModules: DynamicModule[]
): Provider[] {
  const adminClient: KafkaJS.Admin | undefined =
    options.adminClient && createAdminClient(options.adminClient);
  const consumer: KafkaJS.Consumer | undefined =
    options.consumer && createConsumer(options.consumer);
  const producer: KafkaJS.Producer | undefined =
    options.producer && createProducer(options.producer);
  const schemaRegistry: SchemaRegistryClient | undefined =
    options.schemaRegistry && createSchemaRegistry(options.schemaRegistry);

  const providers: Provider[] = [
    { provide: KAFKA_CONFIGURATION_TOKEN, useValue: options },
    { provide: KAFKA_ADMIN_CLIENT_TOKEN, useValue: adminClient },
    { provide: KAFKA_CONSUMER_TOKEN, useValue: consumer },
    { provide: KAFKA_PRODUCER_TOKEN, useValue: producer },
    { provide: KAFKA_SCHEMA_REGISTRY_TOKEN, useValue: schemaRegistry },
    {
      provide: KafkaMetricsService,
      useValue: new KafkaMetricsService(adminClient, options, consumer),
    },
  ];

  providers.push({
    provide: KAFKA_HEALTH_INDICATOR_TOKEN,
    useFactory: (healthIndicatorService?: HealthIndicatorService) => {
      return new KafkaHealthIndicator(healthIndicatorService, adminClient);
    },
    inject: [{ token: HealthIndicatorService, optional: true }],
  });

  return providers;
}

export function getAsyncKafkaConnectionProvider(
  options: KafkaConnectionAsyncOptions
): Provider[] {
  return [
    {
      provide: KafkaMetricsService,
      useFactory: (
        adminClient?: KafkaJS.Admin,
        config?: KafkaConnectionOptions,
        consumer?: KafkaJS.Consumer,
        ...args
      ) => {
        return new KafkaMetricsService(adminClient, config, consumer);
      },
      inject: [
        { token: KAFKA_ADMIN_CLIENT_TOKEN, optional: true },
        { token: KAFKA_CONFIGURATION_TOKEN, optional: true },
        { token: KAFKA_CONSUMER_TOKEN, optional: true },
        ...(options.inject ?? []),
      ],
    },
    {
      provide: KAFKA_HEALTH_INDICATOR_TOKEN,
      useFactory: (
        healthIndicatorService?: HealthIndicatorService,
        adminClient?: KafkaJS.Admin,
        ...args
      ) => {
        return new KafkaHealthIndicator(healthIndicatorService, adminClient);
      },
      inject: [
        { token: HealthIndicatorService, optional: true },
        { token: KAFKA_ADMIN_CLIENT_TOKEN, optional: true },
        ...(options.inject ?? []),
      ],
    },
    {
      provide: KAFKA_ADMIN_CLIENT_TOKEN,
      inject: options.inject,
      useFactory: async (
        ...args: any[]
      ): Promise<KafkaJS.Admin | undefined> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.adminClient &&
          createAdminClient(connectionOptions.adminClient)
        );
      },
    },
    {
      provide: KAFKA_CONSUMER_TOKEN,
      inject: options.inject,
      useFactory: async (
        ...args: any[]
      ): Promise<KafkaJS.Consumer | undefined> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.consumer &&
          createConsumer(connectionOptions.consumer)
        );
      },
    },
    {
      provide: KAFKA_PRODUCER_TOKEN,
      inject: options.inject,
      useFactory: async (
        ...args: any[]
      ): Promise<KafkaJS.Producer | undefined> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.producer &&
          createProducer(connectionOptions.producer)
        );
      },
    },
    {
      provide: SchemaRegistryClient,
      inject: options.inject,
      useFactory: async (
        ...args: any[]
      ): Promise<SchemaRegistryClient | undefined> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.schemaRegistry &&
          createSchemaRegistry(connectionOptions.schemaRegistry)
        );
      },
    },
  ];
}
