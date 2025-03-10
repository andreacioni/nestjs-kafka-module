import * as rdkafka from "@confluentinc/kafka-javascript";

export const producerConnect = async (
  producer: rdkafka.Producer,
  options?: rdkafka.MetadataOptions
): Promise<void> => {
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      producer.connect(options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }),

    new Promise<void>((resolve) => {
      producer.on("ready", () => resolve());
    }),
  ]);
};

export const consumerConnect = async (
  consumer: rdkafka.KafkaConsumer,
  options?: rdkafka.MetadataOptions
): Promise<void> => {
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      consumer.connect(options, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }),

    new Promise<void>((resolve) => {
      consumer.on("ready", () => resolve());
    }),
  ]);
};

/**
 * Flush records and disconnect
 * @param producer the producer instance to disconnect
 * @param timeout optional, max time to wait for flushing all queued records out
 */
export const producerDisconnect = async (
  producer: rdkafka.Producer,
  timeout?: number
): Promise<void> => {
  if (!producer.isConnected()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    producer.flush(timeout, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  }).finally(() => {
    return new Promise<void>((resolve, reject) => {
      producer.disconnect((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

/**
 * Commit current local-offset and disconnect
 * @param producer the consumer instance to disconnect
 */
export const consumerDisconnect = async (
  consumer: rdkafka.KafkaConsumer
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    consumer.disconnect((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
