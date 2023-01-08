import EventEmitter from "events";
import "durr";

export interface ClientEvents<Response = undefined> extends IClientEvents {
  init: () => void;
  success: (response?: Response) => void;
  fail: (reason: string) => void;
}

export interface WorkerEvents extends IWorkerEvents {
  init: () => void;
  cancel: () => void;
}

export type IWorkerEvents = { [key: string | symbol]: (...args: any[]) => any };
export type IClientEvents = { [key: string | symbol]: (...args: any[]) => any };
export type BasePayload = Record<any, any> | undefined;
export interface Job<Payload extends BasePayload = {}> {
  readonly payload: Payload;
}

export function isJob<Payload extends BasePayload = {}>(
  it: any,
  payloadTypeGuard: (p: any) => p is Payload = function (p: any): p is Payload {
    return typeof p == "object";
  }
): it is Job {
  return it && it.payload && payloadTypeGuard(it.payload) == true;
}

export interface ClientEventEmitter<
  Response,
  Client extends ClientEvents<Response> = ClientEvents<Response>
> extends EventEmitter {
  on<U extends keyof Client>(event: U, listener: Client[U]): this;

  emit<U extends keyof Client>(
    event: U,
    ...args: Parameters<Client[U]>
  ): boolean;
}

export class ClientEventEmitter<
  Response,
  Client extends ClientEvents<Response> = ClientEvents<Response>
> extends EventEmitter {
  constructor() {
    super();
  }
}

export interface WorkerEventEmitter<Worker extends WorkerEvents = WorkerEvents>
  extends EventEmitter {
  on<U extends keyof Worker>(event: U, listener: Worker[U]): this;

  emit<U extends keyof Worker>(
    event: U,
    ...args: Parameters<Worker[U]>
  ): boolean;
}

export class WorkerEventEmitter<
  Worker extends WorkerEvents = WorkerEvents
> extends EventEmitter {
  constructor() {
    super();
  }
}

export class JobWorker<T, U> {
  constructor(public currentPayload?: T, public lastResponse?: U) {}
}

export type JobId = string;

export interface JobQueue<
  Payload extends BasePayload = {},
  Response = undefined,
  Client extends ClientEvents<Response> = ClientEvents<Response>,
  Worker extends WorkerEvents = WorkerEvents
> {
  submit(
    job: Job<Payload>,
    preHook?: (emitter: ClientEventEmitter<Client>) => void
  ): Promise<JobId>;
  register(
    handler: (
      job: Job<Payload>,
      context: ClientEventEmitter<Response>,
      workerEvents: WorkerEventEmitter<Worker>
    ) => void
  ): JobWorker<Payload, Response>;
  monitor(jobId: JobId): ClientEventEmitter<Client>;
  cancel(jobId: JobId): void;
  notify(
    jobId: JobId,
    eventName: keyof Worker,
    ...params: Parameters<Worker[typeof eventName]>
  ): Promise<void>;
}
