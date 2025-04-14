import { KafkaJS } from "@confluentinc/kafka-javascript";
import { DynamicModule, Provider } from "@nestjs/common";
import {
  KafkaConnectionAsyncOptions,
  KafkaConnectionOptions,
} from "./interfaces/kafka-connection-options";
import {
  KAFKA_ADMIN_CLIENT_PROVIDER,
  KAFKA_CONFIGURATION_PROVIDER,
  KAFKA_CONSUMER_PROVIDER,
  KAFKA_PRODUCER_PROVIDER,
  getAsyncKafkaConnectionProvider,
  getKafkaConnectionProviderList,
} from "./providers/kafka.connection";
import KafkaLifecycleManager from "./providers/kafka.lifecycle";
import { debugLog } from "./utils/kafka.utils";

const getKafkaLifecycleMangerProvider = (): Provider => {
  return {
    provide: KafkaLifecycleManager,
    useFactory: (
      admin: KafkaJS.Admin,
      producer: KafkaJS.Producer,
      consumer: KafkaJS.Consumer,
      config: KafkaConnectionOptions
    ): KafkaLifecycleManager => {
      return new KafkaLifecycleManager(config, producer, consumer, admin);
    },
    inject: [
      KAFKA_ADMIN_CLIENT_PROVIDER,
      KAFKA_PRODUCER_PROVIDER,
      KAFKA_CONSUMER_PROVIDER,
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
    const modules = this.loadPluginModules();

    const connectionProvider = getKafkaConnectionProviderList(options, modules);

    return {
      module: KafkaModule,
      imports: modules,
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

    const modules = this.loadPluginModules();

    return {
      module: KafkaModule,
      imports: [options.imports, ...modules],
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

  static loadPluginModules(): DynamicModule[] {
    try {
      const { TerminusModule } = require("@nestjs/terminus");
      return [{ module: TerminusModule }];
    } catch (e) {
      debugLog("TerminusModule not found ");
      return [];
    }
  }
}
