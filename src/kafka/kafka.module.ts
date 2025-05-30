import { KafkaJS } from "@confluentinc/kafka-javascript";
import {
  DynamicModule,
  ForwardReference,
  Provider,
  Type,
} from "@nestjs/common";
import {
  KafkaConnectionAsyncOptions,
  KafkaConnectionOptions,
} from "./interfaces/kafka-connection-options";
import {
  KAFKA_ADMIN_CLIENT_TOKEN,
  KAFKA_CONFIGURATION_TOKEN,
  KAFKA_CONSUMER_TOKEN,
  KAFKA_PRODUCER_TOKEN,
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
      KAFKA_ADMIN_CLIENT_TOKEN,
      KAFKA_PRODUCER_TOKEN,
      KAFKA_CONSUMER_TOKEN,
      KAFKA_CONFIGURATION_TOKEN,
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
    const providers: Provider[] = getAsyncKafkaConnectionProvider(options);

    const modules: DynamicModule[] = this.loadPluginModules();
    const imports: Array<
      Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference
    > = options.imports ?? [];

    return {
      module: KafkaModule,
      imports: [...imports, ...modules],
      providers: [...providers, getKafkaLifecycleMangerProvider()],
      exports: providers,
      global: options.global ?? true,
    };
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
