import EventEmitter from "events";

export enum JobStatus {
  START = "START",
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
}

export interface WorkerContext<Response = void> {
  start: () => void;
  success: (result: Response) => void;
  fail: (reason: string) => void;
}

export interface ClientEvents<Response> extends IClientEvents {
  status: (status: JobStatus) => void;
  success: (response: Response) => void;
  fail: (reason: String) => void;
}

export interface WorkerEvents extends IWorkerEvents {
  cancel: () => void;
}

export type IWorkerEvents = { [key: string | symbol]: (...args: any[]) => any };
export type IClientEvents = { [key: string | symbol]: (...args: any[]) => any };

export interface Job<
  Payload, // TODO defaults & extends {} | undefined
  Response, // TODO defaults & extends {} | undefined
  Client extends ClientEvents<Response> = ClientEvents<Response>,
  Worker extends WorkerEvents = WorkerEvents
> {
  readonly payload: Payload;
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

export interface JobWorker<T, U> {}

export type JobId = string;

export interface JobQueue<
  Payload,
  Response,
  Client extends ClientEvents<Response> = ClientEvents<Response>,
  Worker extends WorkerEvents = WorkerEvents,
  JobExtension extends Job<Payload, Response, Client, Worker> = Job<
    Payload,
    Response,
    Client,
    Worker
  >
> {
  submit(job: JobExtension): Promise<JobId>;
  register(
    handler: (
      job: JobExtension,
      context: WorkerContext<Response>,
      workerEvents: WorkerEventEmitter<Worker>
    ) => void
  ): JobWorker<Payload, Response>;
  // TODO first vs latest
  monitor(jobId: JobId): ClientEventEmitter<Client>;
  cancel(jobId: JobId): void;
}
