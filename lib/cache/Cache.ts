import { StreamMetadata } from "../models.js";

export interface Cache {
  getStreamMetadata(id: string): Promise<StreamMetadata | null>;
  putStreamMetadata(
    id: string,
    m3u8: StreamMetadata,
    expiration: Date
  ): Promise<void>;
  delStreamMetadata(id: string): Promise<void>;
  expireStreamMetadata(id: string, expiration: Date): Promise<void>;

  getSegmentM4s(streamId: string, segmentId: number): Promise<Buffer | null>;
  putSegmentM4s(
    streamId: string,
    segmentId: number,
    segment: Buffer,
    expiration: Date
  ): Promise<void>;
  delSegmentM4s(streamId: string, segmentId: number): Promise<void>;
  expireSegmentM4s(
    streamId: string,
    segmentId: number,
    expiration: Date
  ): Promise<void>;

  getInitMp4(streamId: string): Promise<Buffer | null>;
  putInitMp4(
    streamId: string,
    initMp4: Buffer,
    expiration: Date
  ): Promise<void>;
  delInitMp4(streamId: string): Promise<void>;
  expireInitMp4(id: string, expiration: Date): Promise<void>;

  getImage(imageId: string): Promise<Buffer | null>;
  putImage(
    imageId: string,
    image: Buffer,
    expirationSecs: number
  ): Promise<void>;
  delImage(imageId: string): Promise<void>;
  expireImage(imageId: string, seconds: number): Promise<void>;

  put(key: string, value: string, expiration: Date): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}
