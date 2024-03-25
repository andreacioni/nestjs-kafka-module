# nestjs-kafka-module

[![NPM](https://nodei.co/npm/nest-kafka-module.png)](https://www.npmjs.com/package/nestjs-kafka-module)

[![npm version](https://badge.fury.io/js/nestjs-kafka-module.svg)](https://badge.fury.io/js/nestjs-kafka-module)
[![Release](https://github.com/andreacioni/nestjs-kafka-module/actions/workflows/release.yml/badge.svg)](https://github.com/andreacioni/nestjs-kafka-module/actions/workflows/release.yml)
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

Initialize a `KafkaModule` with configuration for a `consumer`, `producer` or `adminClient` respectively. A full list of configuration for each item can be found on `node-rdkafka`'s [Configuration](https://github.com/Blizzard/node-rdkafka#configuration) section.

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
export class AppModule {}
```

**cats.service.ts**

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { KafkaConsumer, Producer, IAdminClient } from "node-rdkafka";

@Injectable()
export class CatsService {
  constructor(
    private readonly kafkaConsumer: KafkaConsumer,
    private readonly kafkaProducer: Producer,
    @Inject("KAFKA_ADMIN_CLIENT_PROVIDER")
    private readonly kafkaAdminClient: IAdminClient
  ) {
    /* Trying to get an instance of a provider without defining a dedicated configuration will result in an error. */
  }
}
```

It is not mandatory to define configuration for any `consumer`, `producer` or `adminClient`, you're free to define just what you need. Keep in mind the table below showing which `Provider` is going to be available in your context based on the defined configuration:

| Configuration | Provider                      |
| ------------- | ----------------------------- |
| consumer      | `KafkaConsumer`               |
| producer      | `Producer`                    |
| admin         | `KAFKA_ADMIN_CLIENT_PROVIDER` |

## Examples

In the [example](example/) folder you can find examples of Nest application that uses this library. 


## Async initialization

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

## Auto connect

By default, during `KafkaModule` initialization, a connection attempt is done automatically. However this implies that if the broker connection is not available (broker is temporary down/not accessible) during startup, the NestJS initialization may fail.

Is it possible to change this behavior using `autoConnect` flag on `KafkaConsuner` and `Producer` as shown below:

```typescript
KafkaModule.forRoot({
  consumer: {
    autoConnect: false,
    conf: {
      "group.id": "nestjs-rdkafka-test",
      "metadata.broker.list": "127.0.0.1:9092",
    },
  },
  producer: {
    autoConnect: false,
    conf: {
      "metadata.broker.list": "127.0.0.1:9092",
    },
  },
});
```

### Disconnect

All clients will be automatically disconnected from Kafka `onModuleDestroy`. You can manually disconnect by calling:

```typescript
await this.consumer?.disconnect();
await this.producer?.disconnect();
await this.adminClient?.disconnect();
```

## License

nestjs-kafka-module is [MIT licensed](LICENSE).
