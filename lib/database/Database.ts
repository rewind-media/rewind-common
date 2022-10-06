import session from "express-session";
import { RootLogger } from "../util";
import {
  FileInfo,
  ImageInfo,
  Library,
  SeriesInfo,
  ShowEpisodeInfo,
  ShowSeasonInfo,
  User,
} from "@rewind-media/rewind-protocol";

export interface Database {
  initialize(): Promise<Database>;

  get sessionStore(): session.Store;

  getUser(username: string): Promise<User | undefined>;
  putUser(user: User): Promise<boolean>;
  deleteUser(username: string): Promise<boolean>;
  listUsers(): Promise<User[]>;

  listLibraries(): Promise<Library[]>;
  getLibrary(libraryId: string): Promise<Library | undefined>;
  upsertLibrary(library: Library): Promise<boolean>;

  getImage(imageId: string): Promise<ImageInfo | undefined>;
  upsertImage(image: ImageInfo): Promise<boolean>;
  deleteImage(imageId: string): Promise<boolean>;
  cleanImages(before: Date, libraryId: string): Promise<number>;

  getImage(fileId: string): Promise<FileInfo | undefined>;
  upsertFile(file: FileInfo): Promise<boolean>;
  deleteFile(fileId: string): Promise<boolean>;
  cleanFiles(before: Date, libraryId: string): Promise<number>;

  listShows(libraryId: string): Promise<SeriesInfo[]>;
  listShowSeasons(showId: string): Promise<ShowSeasonInfo[]>;
  listShowSeasonEpisodes(seasonId: string): Promise<ShowEpisodeInfo[]>;

  getShow(showId: string): Promise<SeriesInfo | undefined>;
  getShowSeason(seasonId: string): Promise<ShowSeasonInfo | undefined>;
  getShowEpisode(episodeId: string): Promise<ShowEpisodeInfo | undefined>;

  upsertShow(show: SeriesInfo): Promise<boolean>;
  upsertShowSeason(season: ShowSeasonInfo): Promise<boolean>;
  upsertShowEpisode(episode: ShowEpisodeInfo): Promise<boolean>;

  deleteShow(showId: string): Promise<boolean>;
  deleteShowSeason(seasonId: string): Promise<boolean>;
  deleteShowEpisode(episodeId: string): Promise<boolean>;

  cleanShows(before: Date, libraryId: string): Promise<number>;
  cleanShowSeasons(before: Date, libraryId: string): Promise<number>;
  cleanShowEpisodes(before: Date, libraryId: string): Promise<number>;
}

export const DatabaseLogger = RootLogger.getChildCategory("Database");
