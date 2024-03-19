import { ModuleMetadata } from "@nestjs/common";
import { KafkaAdminClientOptions } from "./kafka-admin-client-options";
import { KafkaConsumerOptions } from "./kafka-consumer-options";
import { KafkaProducerOptions } from "./kafka-producer-options";

export interface KafkaConnectionOptions {
  consumer?: KafkaConsumerOptions;
  producer?: KafkaProducerOptions;
  adminClient?: KafkaAdminClientOptions;
  global?: boolean;
}

export interface KafkaConnectionAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  useFactory: (
    ...args: any[]
  ) => Promise<KafkaConnectionOptions> | KafkaConnectionOptions;
  inject?: any[];
  global?: boolean;
}
