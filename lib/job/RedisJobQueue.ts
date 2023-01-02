import {
  ClientEventEmitter,
  ClientEvents,
  JobId,
  JobQueue,
  JobWorker,
  WorkerEventEmitter,
  WorkerEvents,
  Job,
} from "./JobQueue.js";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { RootLogger } from "../util/log.js";
import { Duration } from "durr";
import { List } from "immutable";

interface ClientStreamMessage<
  Response,
  Client extends ClientEvents<Response> = ClientEvents<Response>
> {
  type: keyof Client;
  payload: Parameters<Client[keyof Client]>;
}

interface WorkerStreamMessage<Worker extends WorkerEvents = WorkerEvents> {
  type: keyof Worker;
  payload: Parameters<Worker[keyof Worker]>;
}

interface JobWrapper<Payload extends Record<any, any> = {}> {
  id: JobId;
  job: Job<Payload>;
}

const log = RootLogger.getChildCategory("RedisJobQueue");

class WorkerContextEmitter<
  Response,
  Client extends ClientEvents<Response> = ClientEvents<Response>
> extends ClientEventEmitter<Response, Client> {
  constructor(
    private defaultHandler: <U extends keyof Client>(
      event: U,
      ...args: Parameters<Client[U]>
    ) => void
  ) {
    super();
  }
  override emit<U extends keyof Client>(
    event: U,
    ...args: Parameters<Client[U]>
  ): boolean {
    const superCall = super.emit(event, ...args);
    if (!superCall) {
      this.defaultHandler(event, ...args);
    }
    return true;
  }
}

export class RedisJobQueue<
  Payload extends Record<any, any> = {},
  Response = undefined,
  Client extends ClientEvents<Response> = ClientEvents<Response>,
  Worker extends WorkerEvents = WorkerEvents
> implements JobQueue<Payload, Response, Client, Worker>
{
  private readonly redis: Redis;
  private readonly id: string;
  private readonly queueId: string;
  constructor(redis: Redis, id: string = randomUUID()) {
    this.redis = redis;
    this.id = id;
    this.queueId = `JobQueue:${id}:Queue`;
  }

  private mkWorkerStreamId = (jobId: JobId) =>
    `JobQueue:${this.id}:Worker:${jobId}`;
  private mkClientStreamId = (jobId: JobId) =>
    `JobQueue:${this.id}:Client:${jobId}`;

  private readStream(
    streamId: string,
    handler: (messages: string) => void,
    lastId: string = "0-0"
  ) {
    const conn = this.redis.duplicate();
    const read = (internalLastId: string = "0-0") => {
      conn
        .xread("BLOCK", 0, "STREAMS", streamId, internalLastId)
        .then((results) => {
          if (results && results[0]) {
            const [, messages] = results[0];
            const lastMessage = List(messages).last();
            const latestLastId = lastMessage ? lastMessage[0] : internalLastId;
            messages
              .flatMap(([, fields]) =>
                // key value pairs, and we only want the values for the messages
                fields.filter((value, index) => index % 2 == 1 && value)
              )

              .forEach((it) => {
                log.info(`Received message from ${streamId}: ${it}`);
                handler(it);
              });
            read(latestLastId);
          } else {
            read();
          }
        });
    };
    read(lastId);
  }

  monitor(jobId: JobId): ClientEventEmitter<Response, Client> {
    const emitter = new ClientEventEmitter<Response, Client>();

    this.readStream(this.mkClientStreamId(jobId), (field) => {
      const clientStreamMessage: ClientStreamMessage<Response, Client> =
        JSON.parse(field);
      emitter.emit(
        clientStreamMessage.type,
        ...(clientStreamMessage.payload ?? [])
      );
    });
    return emitter;
  }

  register(
    handler: (
      job: Job<Payload>,
      context: ClientEventEmitter<Client>,
      workerEvents: WorkerEventEmitter<Worker>
    ) => void
  ): JobWorker<Payload, Response> {
    const worker = new JobWorker<Payload, Response>();
    const redisInstance = this.redis.duplicate();
    const read = () => {
      redisInstance.blpop(this.queueId, 0).then(async (item) => {
        if (item) {
          const [, rawWrapper] = item;
          const wrapper: JobWrapper<Payload> = JSON.parse(rawWrapper);
          worker.currentPayload = wrapper.job.payload;
          const emitter = new WorkerContextEmitter<Response, Client>(
            (event, ...args) => this.sendMessage(wrapper.id, event, args)
          );
          await handler(
            wrapper.job,
            emitter,
            this.mkWorkerEventEmitter(wrapper.id)
          );
        }
        return read();
      });
    };
    read();
    return worker;
  }

  private sendMessage(
    jobId: JobId,
    messageType: keyof Client,
    ...handlerArgs: any
  ) {
    this.redis.xadd(
      this.mkClientStreamId(jobId),
      "*",
      randomUUID(),
      JSON.stringify({
        type: messageType.toString(),
        payload: handlerArgs,
      } as ClientStreamMessage<Client>)
    );
  }

  private mkWorkerEventEmitter(jobId: JobId): WorkerEventEmitter<WorkerEvents> {
    const emitter = new WorkerEventEmitter();
    this.readStream(this.mkWorkerStreamId(jobId), (field) => {
      const workerStreamMessage = JSON.parse(field) as WorkerStreamMessage;
      emitter.emit(workerStreamMessage.type, workerStreamMessage.payload);
    });
    return emitter;
  }

  async submit(
    job: Job<Payload>,
    preHook?: (emitter: ClientEventEmitter<Client>) => void
  ): Promise<JobId> {
    const id: JobId = randomUUID();
    await Promise.all([
      this.setupWorkerStream(
        this.mkWorkerStreamId(id),
        Duration.days(1).after()
      ),
      this.setupClientStream(
        this.mkClientStreamId(id),
        Duration.days(1).after()
      ),
    ]);
    if (preHook) {
      await preHook(this.monitor(id));
    }
    return this.redis
      .lpush(
        this.queueId,
        JSON.stringify({
          id: id,
          job: job,
        } as JobWrapper<Payload>)
      )
      .then(() => id);
  }

  cancel(jobId: JobId) {
    this.redis.xadd(
      this.mkWorkerStreamId(jobId),
      "*",
      randomUUID(),
      JSON.stringify({
        type: "cancel",
        payload: [] as any[],
      } as WorkerStreamMessage<Worker>)
    );
  }

  private setupWorkerStream = (streamId: string, expiration: Date) =>
    this.setupStream(
      streamId,
      expiration,
      JSON.stringify({
        type: "init",
        payload: [] as any[],
      } as ClientStreamMessage<Client>)
    );

  private setupClientStream = (streamId: string, expiration: Date) =>
    this.setupStream(
      streamId,
      expiration,
      JSON.stringify({
        type: "init",
        payload: [] as any[],
      } as WorkerStreamMessage<Worker>)
    );

  private setupStream(streamId: string, expiration: Date, message: string) {
    return this.redis.xadd(streamId, "*", randomUUID(), message).then((res) => {
      if (res) {
        return this.redis
          .xdel(streamId, res)
          .then(() =>
            this.redis.expire(streamId, calculateTtlSecs(expiration))
          );
      } else {
        log.error(
          "Failed to initialize stream - no id assigned to init message."
        );
        return Promise.resolve(0);
      }
    });
  }
}

function calculateTtlSecs(expiration: Date): number {
  return Math.ceil(Duration.between(new Date(), expiration).seconds);
}
