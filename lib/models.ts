export interface StreamSegmentMetadata {
  readonly index: number;
  readonly duration: number;
}

export interface Mime {
  mimeType: string;
  codecs: string[]; // RFC 6381
}

export interface StreamMetadata {
  readonly segments: StreamSegmentMetadata[];
  readonly subtitles?: string;
  readonly mime: Mime;
  readonly complete: boolean;
  readonly processedSecs: number;
  readonly totalDurationSecs: number;
}
