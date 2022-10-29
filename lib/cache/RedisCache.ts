import { Cache } from "./Cache";
import Redis from "ioredis";
import { RedisOptions } from "ioredis/built/redis/RedisOptions";

function calculateTtlSecs(expiration: Date): number {
  return Math.ceil((expiration.getTime() - new Date().getTime()) / 1000);
}

export class RedisCache implements Cache {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  getM3u8(streamId: string): Promise<string | null> {
    return this.redis
      .get(`${streamId}.m3u8`)
      .then((it) => (it ? Buffer.from(it, "base64").toString("utf8") : null));
  }

  putM3u8(streamId: string, m3u8: string, expiration: Date): Promise<void> {
    return this.redis
      .setex(
        `${streamId}.m3u8`,
        calculateTtlSecs(expiration),
        Buffer.from(m3u8, "utf8").toString("base64")
      )
      .then();
  }

  delM3u8(streamId: string): Promise<void> {
    return this.redis.del(`${streamId}.m3u8`).then();
  }

  getInitMp4(streamId: string): Promise<Buffer | null> {
    return this.redis.get(`${streamId}.init.mp4`).then((it) => {
      if (it) {
        return Buffer.from(it, "base64");
      } else return null;
    });
  }

  putInitMp4(
    streamId: string,
    initMp4: Buffer,
    expiration: Date
  ): Promise<void> {
    return this.redis
      .setex(
        `${streamId}.init.mp4`,
        calculateTtlSecs(expiration),
        initMp4.toString("base64")
      )
      .then();
  }

  delInitMp4(streamId: string): Promise<void> {
    return this.redis.del(`${streamId}.init.mp4`).then();
  }

  getSegmentM4s(streamId: string, segmentId: number): Promise<Buffer | null> {
    return this.redis.get(`${streamId}:${segmentId}.m4s`).then((it) => {
      if (it) {
        return Buffer.from(it, "base64");
      } else return null;
    });
  }

  putSegmentM4s(
    streamId: string,
    segmentId: number,
    segment: Buffer,
    expiration: Date
  ): Promise<void> {
    return this.redis
      .setex(
        `${streamId}:${segmentId}.m4s`,
        calculateTtlSecs(expiration),
        segment.toString("base64")
      )
      .then();
  }

  delSegmentM4s(streamId: string, segmentId: number): Promise<void> {
    return this.redis.del(`${streamId}:${segmentId}.m4s`).then();
  }

  getImage(imageId: string): Promise<Buffer | null> {
    return this.redis.get(`Image:${imageId}`).then((it) => {
      if (it) {
        return Buffer.from(it, "base64");
      } else return null;
    });
  }

  putImage(imageId: string, image: Buffer, expiration: Date): Promise<void> {
    return this.redis
      .setex(
        `Image:${imageId}`,
        calculateTtlSecs(expiration),
        image.toString("base64")
      )
      .then();
  }

  delImage(imageId: string): Promise<void> {
    return this.redis.del(`Image:${imageId}`).then();
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  del(key: string): Promise<void> {
    return this.redis.del(key).then();
  }

  put(key: string, value: string, expiration: Date): Promise<void> {
    return this.redis.setex(key, calculateTtlSecs(expiration), value).then();
  }
}
