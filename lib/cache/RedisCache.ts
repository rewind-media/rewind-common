import { Cache, JobEventEmitter, JobEvents, JobQueue } from "./Cache";
import { Job } from "../models";
import { RootLogger } from "../util";
import Redis from "ioredis";
import { RedisOptions } from "ioredis/built/redis/RedisOptions";

function calculateTtlSecs(expiration: Date): number {
  return Math.ceil((expiration.getTime() - new Date().getTime()) / 1000);
}

const log = RootLogger.getChildCategory("RedisCache");

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

  getJobQueue(id: string): JobQueue {
    return new RedisJobQueue(id, this.redis);
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

export class RedisJobQueue implements JobQueue {
  private readonly redis: Redis;
  private readonly id: string;
  private readonly jobQueueKey: string;

  constructor(id: string, redis: Redis) {
    this.id = id;
    this.jobQueueKey = `JobQueue:${this.id}`;
    this.redis = redis;
  }

  current(jobId: string): Promise<keyof JobEvents | undefined> {
    return this.redis
      .get(this.mkJobStatusKey(jobId))
      .then((it) => it as keyof JobEvents)
      .catch((reason: any) => {
        log.error(reason);
        return new Promise<undefined>((resolve) => resolve(undefined));
      });
  }

  monitor(jobId: string): Promise<JobEventEmitter> {
    const emitter = new JobEventEmitter();
    const channelName = this.mkJobStatusChannelName(jobId);
    const statusName = this.mkJobStatusKey(jobId);
    const subRedis = this.redis.duplicate();

    subRedis.subscribe(channelName);
    subRedis.on("message", async (channel, message) => {
      if (channel === channelName && message === "set") {
        try {
          const state = (await this.redis.get(statusName)) as
            | keyof JobEvents
            | undefined;
          if (state) {
            emitter.emit(state);
          }
          if (state === "fail" || state === "succeed" || state === "cancel") {
            await subRedis.unsubscribe(channelName);
            await subRedis.quit();
          }
        } catch (e) {
          log.error(`Failed to parse update from ${jobId}`, e);
        }
      }
    });

    return new Promise<JobEventEmitter>((resolve) => resolve(emitter));
  }

  publish(job: Job): Promise<JobEventEmitter> {
    // TODO this basic list of jobs sucks for distributing work.
    return this.redis
      .rpush(this.jobQueueKey, JSON.stringify(job))
      .then(() =>
        this.redis.set(this.mkJobStatusKey(job.id), "submit" as keyof JobEvents)
      )
      .then(() => this.monitor(job.id));
  }

  private mkJobStatusChannelName(jobId: string) {
    return `__keyspace@0__:${this.mkJobStatusKey(jobId)}`;
  }

  private mkJobStatusKey(jobId: string) {
    return `JobQueue:${this.id}:JobState:${jobId}`;
  }

  listen(): Promise<Job> {
    return new Promise(async (resolve) => {
      let res = null;
      do {
        res = await this.redis.blpop(this.jobQueueKey, 1);
      } while (!res);
      const [key, val] = res;
      resolve(JSON.parse(val));
    });
  }

  update(
    jobId: string,
    state: keyof JobEvents,
    expiration: Date
  ): Promise<void> {
    return this.redis
      .setex(
        this.mkJobStatusKey(jobId),
        calculateTtlSecs(expiration),
        state as string
      )
      .then(() => {
        return;
      });
  }
}

export function mkRedisCache(props: RedisOptions): Promise<Cache> {
  const client = new Redis(props);
  return new Promise((resolve) => resolve(new RedisCache(client)));
}
