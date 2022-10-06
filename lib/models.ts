import { StreamProps } from "@rewind-media/rewind-protocol";

export type JobPayload = StreamProps;

export interface Job {
  readonly id: string;
  readonly payload: StreamProps;
}
