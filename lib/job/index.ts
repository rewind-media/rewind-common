import { ClientEvents, Job, JobQueue, WorkerEvents } from "./JobQueue.js";
import { StreamProps } from "@rewind-media/rewind-protocol";

export type StreamJob = Job<StreamProps>;

export interface StreamClientEvents extends ClientEvents<undefined> {
  start: () => void;
}
export interface StreamWorkerEvents extends WorkerEvents {
  heartbeat: () => void;
}

export type StreamJobQueue = JobQueue<
  StreamProps,
  undefined,
  StreamClientEvents
>;
export * from "./JobQueue.js";
export * from "./RedisJobQueue.js";
