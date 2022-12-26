import { Job, JobQueue } from "./JobQueue.js";
import { StreamProps } from "@rewind-media/rewind-protocol";

export type StreamJob = Job<StreamProps>;
export type StreamJobQueue = JobQueue<StreamProps, undefined>;
export * from "./JobQueue.js";
export * from "./RedisJobQueue.js";
