# nestjs-kafka-module

[![NPM](https://nodei.co/npm/nest-kafka-module.png)](https://www.npmjs.com/package/nestjs-kafka-module)

[![npm version](https://badge.fury.io/js/nestjs-kafka-module.svg)](https://badge.fury.io/js/nestjs-kafka-module)
[![Release](https://github.com/andreacioni/nestjs-kafka-module/actions/workflows/release.yml/badge.svg)](https://github.com/andreacioni/nestjs-kafka-module/actions/workflows/release.yml)
![npm](https://img.shields.io/npm/dm/nestjs-kafka-module)
![npm bundle size](https://img.shields.io/bundlephobia/min/nestjs-kafka-module)  
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=andreacioni_nestjs-kafka-module&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=andreacioni_nestjs-kafka-module)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=andreacioni_nestjs-kafka-module&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=andreacioni_nestjs-kafka-module)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=andreacioni_nestjs-kafka-module&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=andreacioni_nestjs-kafka-module)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=andreacioni_nestjs-kafka-module&metric=coverage)](https://sonarcloud.io/summary/new_code?id=andreacioni_nestjs-kafka-module)

## Description

A [NestJS](https://nestjs.com/) module wrapper for [@confluentinc/kafka-javascript](https://github.com/confluentinc/confluent-kafka-javascript).

## Installation

```bash
npm i nestjs-kafka-module @confluentinc/kafka-javascript
```

Requirements:

|         | Min | Max |
| ------- | --- | --- |
| Node.JS | 18  | 22  |
| NestJS  | 9   | 11  |

## Basic usage

Initialize a `KafkaModule` with configuration for a `consumer`, `producer` or `adminClient` respectively. All the available configuration parameter for each item can be found on `@confluentinc/kafka-javascript`'s [Configuration](https://github.com/confluentinc/librdkafka/blob/v2.3.0/CONFIGURATION.md) section.

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
import {
  KafkaConsumer,
  Producer,
  IAdminClient,
} from "@confluentinc/kafka-javascript";
import { KAFKA_ADMIN_CLIENT_TOKEN } from "nestjs-kafka-module";

@Injectable()
export class CatsService {
  constructor(
    @Inject(KAFKA_CONSUMER_TOKEN)
    private readonly consumer: KafkaJS.Consumer,
    @Inject(KAFKA_PRODUCER_TOKEN)
    private readonly producer: KafkaJS.Producer,
    @Inject(KAFKA_ADMIN_CLIENT_TOKEN) 
    private readonly admin: KafkaJS.Admin,
    @Inject(KAFKA_SCHEMA_REGISTRY_TOKEN)
    private readonly schemaRegistry: SchemaRegistryClient
  ) {
    /* Trying to get an instance of a provider without defining a dedicated configuration will result in an error. */
  }
}
```

It is not mandatory to define configuration for any `consumer`, `producer` or `adminClient`, you're free to define just what you need. Keep in mind the table below showing which `Provider` is going to be available in your context based on the defined configuration:

| Configuration        | Token                                                      | Type                   |
| -------------------- | ---------------------------------------------------------- | ---------------------- |
| consumer             | "KAFKA_CONSUMER_TOKEN"                                     | `KafkaJS.Consumer`     |
| producer             | "KAFKA_PRODUCER_TOKEN"                                     | `KafkaJS.Producer`     |
| admin                | "KAFKA_ADMIN_CLIENT_TOKEN"                                 | `KafkaJS.Admin`        |
| schemaRegistry       | `SchemaRegistryClient` _or_ "KAFKA_SCHEMA_REGISTRY_TOKEN" | `SchemaRegistryClient` |
| kafkaHealthIndicator | `KafkaHealthIndicator` _or_ "KAFKA_HEALTH_INDICATOR_TOKEN" | `KafkaHealthIndicator` |
| metricsService       | `KafkaMetricsService` _or_ "KAFKA_METRICS_TOKEN"           | `KafkaMetricsService`  |

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

Is it possible to change this behavior using `autoConnect` flag on `Consumer` and `Producer` as shown below:

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

## Termination

In case `autoConnect` is set to true, disconnection in handled automatically by the module attaching to `onApplicationShutdown()` hook. However, for this to work you must enable shutdown hooks by doing the following in your `bootstrap.ts`:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Starts listening for shutdown hooks
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

## Health check

Thanks to `@nestjs/terminus` and its integration with NestJS is it possible to expose an indicator to check the status between the application and the broker. This library already expose an indicator when `@nestjs/terminus` is available. You can use it in you `/health` controller by doing this:

```typescript
import {
  HealthCheck,
  HealthCheckService,
} from "@nestjs/terminus";
import {
  KAFKA_ADMIN_CLIENT_TOKEN,
  KAFKA_CONSUMER_TOKEN,
  KAFKA_PRODUCER_TOKEN,
} from "nestjs-kafka-module";
import { KafkaHealthIndicator } from "nestjs-kafka-module";


@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private kafkaHealthIndicator: KafkaHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  healthCheck() {
    return this.health.check([() => this.kafkaHealthIndicator.isHealty()]);
  }
}
```

## Disconnect

All clients will be automatically disconnected from Kafka `onModuleDestroy`. You can manually disconnect by calling:

```typescript
await this.consumer?.disconnect();
await this.producer?.disconnect();
await this.adminClient?.disconnect();
```

## License

nestjs-kafka-module is [MIT licensed](LICENSE).
