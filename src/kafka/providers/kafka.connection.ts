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

export const KAFKA_ADMIN_CLIENT_PROVIDER = "KAFKA_ADMIN_CLIENT";
export const KAFKA_PRODUCER_PROVIDER = "KAFKA_PRODUCER";
export const KAFKA_CONSUMER_PROVIDER = "KAFKA_CONSUMER";
export const KAFKA_CONFIGURATION_PROVIDER = "KAFKA_CONFIGURATION";
export const KAFKA_HEALTH_INDICATOR_PROVIDER = KafkaHealthIndicator;

export function createConsumer(
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
    { provide: KAFKA_CONFIGURATION_PROVIDER, useValue: options },
    { provide: KAFKA_ADMIN_CLIENT_PROVIDER, useValue: adminClient },
    { provide: KAFKA_CONSUMER_PROVIDER, useValue: consumer },
    { provide: KAFKA_PRODUCER_PROVIDER, useValue: producer },
    { provide: SchemaRegistryClient, useValue: schemaRegistry },
  ];

  if (adminClient) {
    providers.push({
      provide: KafkaHealthIndicator,
      useFactory: (healthIndicatorService?: HealthIndicatorService) => {
        return new KafkaHealthIndicator(healthIndicatorService, adminClient);
      },
      inject: [{ token: HealthIndicatorService, optional: true }],
    });
  }

  return providers;
}

export function getAsyncKafkaConnectionProvider(
  options: KafkaConnectionAsyncOptions
): Provider[] {
  return [
    {
      provide: KAFKA_HEALTH_INDICATOR_PROVIDER,
      useFactory: (
        healthIndicatorService?: HealthIndicatorService,
        adminClient?: KafkaJS.Admin,
        ...args
      ) => {
        return new KafkaHealthIndicator(healthIndicatorService, adminClient);
      },
      inject: [
        { token: HealthIndicatorService, optional: true },
        { token: KAFKA_ADMIN_CLIENT_PROVIDER, optional: true },
        ...(options.inject ?? []),
      ],
    },
    {
      provide: KAFKA_ADMIN_CLIENT_PROVIDER,
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
      provide: KAFKA_CONSUMER_PROVIDER,
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
      provide: KAFKA_PRODUCER_PROVIDER,
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
