import { Job } from "../models";
import EventEmitter from "events";

export interface Cache {
  getM3u8(id: string): Promise<string | null>;
  putM3u8(id: string, m3u8: string, expiration: Date): Promise<void>;
  delM3u8(id: string): Promise<void>;

  getSegmentM4s(streamId: string, segmentId: number): Promise<Buffer | null>;
  putSegmentM4s(
    streamId: string,
    segmentId: number,
    segment: Buffer,
    expiration: Date
  ): Promise<void>;
  delSegmentM4s(streamId: string, segmentId: number): Promise<void>;

  getInitMp4(streamId: string): Promise<Buffer | null>;
  putInitMp4(
    streamId: string,
    initMp4: Buffer,
    expiration: Date
  ): Promise<void>;
  delInitMp4(streamId: string): Promise<void>;

  getImage(imageId: string): Promise<Buffer | null>;
  putImage(imageId: string, image: Buffer, expiration: Date): Promise<void>;
  delImage(imageId: string): Promise<void>;

  put(key: string, value: string, expiration: Date): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;

  getJobQueue(id: string): JobQueue;
}

export interface JobQueue {
  listen(): Promise<Job>;
  publish(job: Job): Promise<JobEventEmitter>;
  update(
    jobId: string,
    event: keyof JobEvents,
    expiration: Date
  ): Promise<void>;
  monitor(jobId: string): Promise<JobEventEmitter>;
  current(jobId: string): Promise<keyof JobEvents | undefined>;
}

export interface JobEvents {
  submit: () => void;
  start: () => void;
  succeed: () => void;
  fail: () => void;
  cancel: () => void;
}
export declare interface JobEventEmitter extends EventEmitter {
  on<U extends keyof JobEvents>(event: U, listener: JobEvents[U]): this;

  emit<U extends keyof JobEvents>(
    event: U,
    ...args: Parameters<JobEvents[U]>
  ): boolean;
}
export class JobEventEmitter extends EventEmitter {
  constructor() {
    super();
  }
}
