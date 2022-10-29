import { Job, JobQueue } from "./JobQueue";
import { StreamProps } from "@rewind-media/rewind-protocol";

export type StreamJob = Job<StreamProps, undefined>;
export type StreamJobQueue = JobQueue<StreamProps, undefined>;
export * from "./JobQueue";
export * from "./RedisJobQueue";
