import { Module } from "@nestjs/common";
import { KafkaModule } from "nestjs-kafka-module/dist/src/index";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    KafkaModule.forRoot({
      consumer: {
        conf: {
          "group.id": "nestjs-rdkafka-test",
          "metadata.broker.list": "127.0.0.1:9092",
        },
      },
      producer: {
        conf: {
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
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
