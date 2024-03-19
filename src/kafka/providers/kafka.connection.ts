import { Provider } from "@nestjs/common";
import * as rdkafka from "node-rdkafka";
import { KafkaAdminClientOptions } from "../interfaces/kafka-admin-client-options";
import {
  KafkaConnectionAsyncOptions,
  KafkaConnectionOptions,
} from "../interfaces/kafka-connection-options";
import { KafkaConsumerOptions } from "../interfaces/kafka-consumer-options";
import { KafkaProducerOptions } from "../interfaces/kafka-producer-options";

export const KAFKA_ADMIN_CLIENT_PROVIDER = " KAFKA_ADMIN_CLIENT";
export const KAFKA_CONFIGURATION_PROVIDER = " KAFKA_CONFIGURATION";

export function createConsumer(
  options: KafkaConsumerOptions
): rdkafka.KafkaConsumer {
  try {
    const consumer = new rdkafka.KafkaConsumer(options.conf, options.topicConf);

    return consumer;
  } catch (err) {
    throw err;
  }
}

function createProducer(options: KafkaProducerOptions): rdkafka.Producer {
  try {
    const producer = new rdkafka.Producer(options.conf, options.topicConf);
    return producer;
  } catch (err) {
    throw err;
  }
}

function createAdminClient(
  options: KafkaAdminClientOptions
): rdkafka.IAdminClient {
  try {
    return rdkafka.AdminClient.create(options.conf);
  } catch (err) {
    throw err;
  }
}

export function getKafkaConnectionProviderList(
  options: KafkaConnectionOptions
): Provider[] {
  const adminClient: rdkafka.IAdminClient | undefined =
    options.adminClient && createAdminClient(options.adminClient);
  const consumer: rdkafka.KafkaConsumer | undefined =
    options.consumer && createConsumer(options.consumer);
  const producer: rdkafka.Producer | undefined =
    options.producer && createProducer(options.producer);

  return [
    { provide: KAFKA_CONFIGURATION_PROVIDER, useValue: options },
    { provide: KAFKA_ADMIN_CLIENT_PROVIDER, useValue: adminClient },
    {
      provide: rdkafka.KafkaConsumer,
      useValue: consumer,
    },
    {
      provide: rdkafka.Producer,
      useValue: producer,
    },
  ];
}

export function getAsyncKafkaConnectionProvider(
  options: KafkaConnectionAsyncOptions
): Provider[] {
  return [
    {
      provide: KAFKA_ADMIN_CLIENT_PROVIDER,
      inject: options.inject,
      useFactory: async (...args: any[]): Promise<rdkafka.IAdminClient> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.adminClient &&
          createAdminClient(connectionOptions.adminClient)
        );
      },
    },
    {
      provide: rdkafka.KafkaConsumer,
      inject: options.inject,
      useFactory: async (...args: any[]): Promise<rdkafka.KafkaConsumer> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.consumer &&
          createConsumer(connectionOptions.consumer)
        );
      },
    },
    {
      provide: rdkafka.Producer,
      inject: options.inject,
      useFactory: async (...args: any[]): Promise<rdkafka.Producer> => {
        const connectionOptions = await options.useFactory(...args);

        return (
          connectionOptions.producer &&
          createProducer(connectionOptions.producer)
        );
      },
    },
  ];
}
