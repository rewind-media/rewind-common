import {
  ClientEventEmitter,
  ClientEvents,
  Job,
  JobId,
  JobQueue,
  JobStatus,
  JobWorker,
  WorkerContext,
  WorkerEventEmitter,
  WorkerEvents,
} from "./JobQueue";
import Redis from "ioredis";
import { randomUUID } from "crypto";
import { last } from "lodash/fp";
import { RootLogger } from "../util";

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

interface JobWrapper<
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
  id: JobId;
  job: JobExtension;
}

const log = RootLogger.getChildCategory("RedisJobQueue");

export class RedisJobQueue<
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
> implements JobQueue<Payload, Response, Client, Worker, JobExtension>
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
    lastId: string = "$"
  ) {
    const conn = this.redis.duplicate();
    const read = (internalLastId: string = "$") => {
      conn
        .xread("BLOCK", 0, "STREAMS", streamId, internalLastId)
        .then((results) => {
          if (results) {
            const [key, messages] = results[0];
            const lastMessage = last(messages);
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
      emitter.emit(clientStreamMessage.type, ...clientStreamMessage.payload);
    });
    return emitter;
  }

  register(
    handler: (
      job: JobExtension,
      context: WorkerContext<Response>,
      workerEvents: WorkerEventEmitter<Worker>
    ) => void
  ): JobWorker<Payload, Response> {
    const read = () => {
      this.redis
        .duplicate()
        .blpop(this.queueId, 0)
        .then(async (item) => {
          if (item) {
            const [, rawWrapper] = item;
            const wrapper: JobWrapper<
              Payload,
              Response,
              Client,
              Worker,
              JobExtension
            > = JSON.parse(rawWrapper);
            await handler(
              wrapper.job,
              {
                success: (result) => {
                  this.sendStatus(wrapper.id, JobStatus.SUCCESS);
                  this.sendSuccess(wrapper.id, result);
                },
                fail: (reason) => {
                  this.sendStatus(wrapper.id, JobStatus.FAIL);
                  this.sendFailure(wrapper.id, reason);
                },
                start: () => {
                  this.sendStatus(wrapper.id, JobStatus.START);
                },
              },
              this.mkWorkerEventEmitter(wrapper.id)
            );
          }
          return read();
        });
    };
    read();
    return {};
  }

  private sendStatus(jobId: JobId, status: JobStatus) {
    log.info(`Sending status ${status} for ${jobId}`);
    this.redis.xadd(
      this.mkClientStreamId(jobId),
      "*",
      randomUUID(),
      JSON.stringify({
        type: "status",
        payload: [status],
      } as ClientStreamMessage<Client>)
    );
  }

  private sendSuccess(jobId: JobId, response: Response) {
    this.redis.xadd(
      this.mkClientStreamId(jobId),
      "*",
      randomUUID(),
      JSON.stringify({
        type: "success",
        payload: [response],
      } as ClientStreamMessage<Client>)
    );
  }

  private sendFailure(jobId: JobId, reason: string) {
    this.redis.xadd(
      this.mkClientStreamId(jobId),
      "*",
      randomUUID(),
      JSON.stringify({
        type: "fail",
        payload: [reason],
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

  submit(job: Job<Payload, Response, Client, Worker>): Promise<JobId> {
    const id: JobId = randomUUID();
    return this.redis
      .lpush(
        this.queueId,
        JSON.stringify({
          id: id,
          job: job,
        } as JobWrapper<Payload, Response>)
      )
      .then(() =>
        Promise.all([
          this.setupStream(this.mkWorkerStreamId(id), nowPlusOneDay()),
          this.setupStream(this.mkClientStreamId(id), nowPlusOneDay()),
        ])
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

  private setupStream(streamId: string, expiration: Date) {
    return this.redis.xadd(streamId, "*", "init", "init").then((res) => {
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

// TODO remove
function nowPlusOneDay(): Date {
  return new Date(Date.now() + 24 * 3600000);
}

function calculateTtlSecs(expiration: Date): number {
  return Math.ceil((expiration.getTime() - new Date().getTime()) / 1000);
}
