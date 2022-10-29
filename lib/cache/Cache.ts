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
}
