import {
  IAdminClient,
  KafkaConsumer,
  Producer,
} from "@confluentinc/kafka-javascript";
import { DynamicModule, Provider } from "@nestjs/common";
import {
  KafkaConnectionAsyncOptions,
  KafkaConnectionOptions,
} from "./interfaces/kafka-connection-options";
import {
  KAFKA_ADMIN_CLIENT_PROVIDER,
  KAFKA_CONFIGURATION_PROVIDER,
  getAsyncKafkaConnectionProvider,
  getKafkaConnectionProviderList,
} from "./providers/kafka.connection";
import KafkaLifecycleManager from "./providers/kafka.lifecycle";

const getKafkaLifecycleMangerProvider = (): Provider => {
  return {
    provide: KafkaLifecycleManager,
    useFactory: (
      adminClient: IAdminClient,
      producer: Producer,
      consumer: KafkaConsumer,
      config: KafkaConnectionOptions
    ): KafkaLifecycleManager => {
      return new KafkaLifecycleManager(config, producer, consumer, adminClient);
    },
    inject: [
      KAFKA_ADMIN_CLIENT_PROVIDER,
      Producer,
      KafkaConsumer,
      KAFKA_CONFIGURATION_PROVIDER,
    ],
  };
};

export class KafkaModule {
  /**
   * Creates the connection to the kafka instance.
   * @param options the options for the node-rdkafka connection.
   * @internal
   */
  static forRoot(options: KafkaConnectionOptions): DynamicModule {
    const connectionProvider = getKafkaConnectionProviderList(options);

    return {
      module: KafkaModule,
      providers: [...connectionProvider, getKafkaLifecycleMangerProvider()],
      exports: [...connectionProvider],
      global: options.global ?? true,
    };
  }

  /**
   * Creates the connection to the kafka instance in an asynchronous fashion.
   * @param options the async options for the node-rdkafka connection.
   */
  static async forRootAsync(
    options: KafkaConnectionAsyncOptions
  ): Promise<DynamicModule> {
    const providers: Provider[] = [...getAsyncKafkaConnectionProvider(options)];

    return {
      module: KafkaModule,
      imports: options.imports,
      providers: [
        {
          provide: KAFKA_CONFIGURATION_PROVIDER,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        ...providers,
        getKafkaLifecycleMangerProvider(),
      ],
      exports: providers,
      global: options.global ?? true,
    } as DynamicModule;
  }
}
