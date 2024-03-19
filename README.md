# nestjs-kafka-module

[![NPM](https://nodei.co/npm/nest-kafka-module.png)](https://www.npmjs.com/package/nestjs-kafka-module)

[![npm version](https://badge.fury.io/js/nestjs-kafka-module.svg)](https://badge.fury.io/js/nestjs-kafka-module)
[![Build Status](https://travis-ci.org/a97001/nestjs-kafka-module.svg?branch=main)](https://travis-ci.org/a97001/nestjs-kafka-module)
![npm](https://img.shields.io/npm/dm/nestjs-kafka-module)
![npm bundle size](https://img.shields.io/bundlephobia/min/nestjs-kafka-module)  
[![Maintainability](https://api.codeclimate.com/v1/badges/08079c0335462972d085/maintainability)](https://codeclimate.com/github/andreacioni/nestjs-kafka-module/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/08079c0335462972d085/test_coverage)](https://codeclimate.com/github/andreacioni/nestjs-kafka-module/test_coverage)

## Description

A [NestJS](https://nestjs.com/) module wrapper for [node-rdkafka](https://github.com/Blizzard/node-rdkafka).

## Installation

```bash
npm i nestjs-kafka-module
```

## Basic usage

Initialize module with configuration of `consumer`, `producer` or `admin client` respectively. A full list of configuration can be found on `node-rdkafka`'s [Configuration](https://github.com/Blizzard/node-rdkafka#configuration) section.

**app.module.ts**

```typescript
import { Module } from "@nestjs/common";
import { KafkaModule } from "nestjs-kafka-module";

@Module({
  imports: [
    KafkaModule.forRoot({
      consumer: {
        conf: {
          "group.id": "kafka_consumer",
          "metadata.broker.list": "127.0.0.1:9092",
        },
      },
      producer: {
        conf: {
          "client.id": "kafka_prducer",
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
})
export class ApplicationModule {}
```

It is possible to dynamically configure the module using `forRootAsync` method and pass, for instance, a `ConfigService` as shown below:

```typescript
import { Module } from "@nestjs/common";
import { KafkaModule } from "nestjs-kafka-module";

@Module({
  imports: [
    KafkaModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const groupId = configService.get("group_id");
        const brokerList = configService.get("metadata_broker_list");
        const clientId = configService.get("cliend_id");

        return {
          consumer: {
            conf: {
              "group.id": groupId,
              "metadata.broker.list": brokerList,
            },
          },
          producer: {
            conf: {
              "client.id": clientId,
              "metadata.broker.list": brokerList,
            },
          },
          adminClient: {
            conf: {
              "metadata.broker.list": brokerList,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class ApplicationModule {}
```

It is not mandatory to define configuration for each `consumer`, `producer` or `admin client`, you're free to define just what you need. Keep in mind the table below showing which Provider is going to be available to you for each defined configuration:

| Configuration | Provider                      |
| ------------- | ----------------------------- |
| consumer      | `KafkaConsumer`               |
| producer      | `Producer`                    |
| admin         | `KAFKA_ADMIN_CLIENT_PROVIDER` |

**cats.service.ts**

```typescript
import { Injectable } from "@nestjs/common";

@Injectable()
export class CatsService {
  constructor(
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly kafkaProducer: Producer,
    private readonly kafkaAdminClient: AdminClient,
  ) {
    /* Trying to get an instance of a provider without defining a dedicated configuration will result in an error. */
  }
}
```

## Auto connect

By default, during `KafkaModule` initialization, a connection attempt is done automatically. However this implies that if the broker connection is not available (broker is temporary down/not accessible) during startup, the NestJS initialization may fail.

## Disconnect

All clients will be automatically disconnected from Kafka `onModuleDestroy`. You can manually disconnect by calling:

```typescript
await this.consumer?.disconnect();
await this.producer?.disconnect();
await this.adminClient?.disconnect();
```

You may also use some utility functions from this library to safe close producer and consumer connection:

```typescript
import { Injectable, Module } from "@nestjs/common";

import {
  safeProducerDisconnect,
  safeConsumerDisconnect,
} from "nestjs-kafka-module";

@Injectable
export class MyService {
  async onModuleDestroy() {
    try {
      await safeConsumerDisconnect(this.consumer);
    } catch (err) {
      console.error(err);
    }

    try {
      await safeProducerDisconnect(this.producer);
    } catch (err) {
      console.error(err);
    }
  }
}
```

## License

nestjs-kafka-module is [MIT licensed](LICENSE).
