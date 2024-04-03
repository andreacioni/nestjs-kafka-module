import { Test, TestingModule } from '@nestjs/testing';
import { KAFKA_ADMIN_CLIENT_PROVIDER, KafkaModule } from 'nestjs-kafka-module';
import { IAdminClient, KafkaConsumer, Producer } from 'node-rdkafka';
import { AppController } from './app.controller';
import { AppModule } from './app.module';
import { AppService } from './app.service';

describe('KafkaModule', () => {
  let consumer: KafkaConsumer;
  let producer: Producer;
  let adminClient: IAdminClient;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        KafkaModule.forRoot({
          consumer: {
            conf: {
              'group.id': 'nestjs-rdkafka-test',
              'metadata.broker.list': '127.0.0.1:9092',
            },
          },
          producer: {
            conf: {
              'metadata.broker.list': '127.0.0.1:9092',
            },
          },
          adminClient: {
            conf: {
              'metadata.broker.list': '127.0.0.1:9092',
            },
          },
        }),
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    producer = app.get<Producer>(Producer);
    consumer = app.get<KafkaConsumer>(KafkaConsumer);
    adminClient = app.get<IAdminClient>(KAFKA_ADMIN_CLIENT_PROVIDER);
  });

  describe('Kafka instances', () => {
    it('should be defined"', () => {
      expect(consumer).toBeDefined();
      expect(producer).toBeDefined();
      expect(adminClient).toBeDefined();
    });
  });
});
