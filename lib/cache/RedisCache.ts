import { Cache } from "./Cache";
import Redis from "ioredis";
import { StreamMetadata } from "../models";
import { RootLogger } from "../util";

function calculateTtlSecs(expiration: Date): number {
  return Math.ceil((expiration.getTime() - new Date().getTime()) / 1000);
}

const log = RootLogger.getChildCategory("RedisCache");

export class RedisCache implements Cache {
  private readonly redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  getStreamMetadata(streamId: string): Promise<StreamMetadata | null> {
    return this.redis.get(`Hls:${streamId}:Metadata`).then((it) => {
      try {
        if (it) {
          return JSON.parse(it) as StreamMetadata;
        }
      } catch (e) {
        log.error(`Failed to parse StreamMetadata: ${it}.`, e);
      }
      return null;
    });
  }

  putStreamMetadata(
    streamId: string,
    m3u8: StreamMetadata,
    expiration: Date
  ): Promise<void> {
    return this.redis
      .setex(
        `Hls:${streamId}:Metadata`,
        calculateTtlSecs(expiration),
        JSON.stringify(m3u8)
      )
      .then();
  }

  delStreamMetadata(streamId: string): Promise<void> {
    return this.redis.del(`Hls:${streamId}:Metadata`).then();
  }

  getInitMp4(streamId: string): Promise<Buffer | null> {
    return this.redis.get(`Hls:${streamId}:init`).then((it) => {
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
        `Hls:${streamId}:init`,
        calculateTtlSecs(expiration),
        initMp4.toString("base64")
      )
      .then();
  }

  delInitMp4(streamId: string): Promise<void> {
    return this.redis.del(`Hls:${streamId}:init`).then();
  }

  getSegmentM4s(streamId: string, segmentId: number): Promise<Buffer | null> {
    return this.redis.get(`Hls:${streamId}:seg:${segmentId}`).then((it) => {
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
        `Hls:${streamId}:seg:${segmentId}`,
        calculateTtlSecs(expiration),
        segment.toString("base64")
      )
      .then();
  }

  delSegmentM4s(streamId: string, segmentId: number): Promise<void> {
    return this.redis.del(`Hls:${streamId}:seg:${segmentId}`).then();
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
