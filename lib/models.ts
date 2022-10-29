export interface StreamSegmentMetadata {
  readonly index: number;
  readonly duration: number;
}

export interface StreamMetadata {
  readonly segments: StreamSegmentMetadata[];
}
