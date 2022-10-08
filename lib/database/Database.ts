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
import { randomUUID } from "crypto";
import { hashPassword } from "../util/hash";
import { isEmpty } from "lodash/fp";

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

export abstract class AbstractDatabase implements Database {
  initialize(): Promise<Database> {
    return this.listUsers()
      .then((userArr) => {
        if (isEmpty(userArr)) {
          const username = "rewind-" + randomUUID();
          const password = randomUUID();
          const salt = randomUUID();
          DatabaseLogger.info(
            `Created initial Rewind user. Username: '${username}', Password: '${password}'`
          );
          return hashPassword(password, salt).then((hashedPass) =>
            this.putUser({
              username: username,
              hashedPass: hashedPass,
              salt: salt,
              permissions: {
                isAdmin: true,
              },
            })
          );
        } else {
          return Promise.resolve(true);
        }
      })

      .then(() => this);
  }

  abstract cleanFiles(before: Date, libraryId: string): Promise<number>;

  abstract cleanImages(before: Date, libraryId: string): Promise<number>;

  abstract cleanShowEpisodes(before: Date, libraryId: string): Promise<number>;

  abstract cleanShowSeasons(before: Date, libraryId: string): Promise<number>;

  abstract cleanShows(before: Date, libraryId: string): Promise<number>;

  abstract deleteFile(fileId: string): Promise<boolean>;

  abstract deleteImage(imageId: string): Promise<boolean>;

  abstract deleteShow(showId: string): Promise<boolean>;

  abstract deleteShowEpisode(episodeId: string): Promise<boolean>;

  abstract deleteShowSeason(seasonId: string): Promise<boolean>;

  abstract deleteUser(username: string): Promise<boolean>;

  abstract getImage(imageId: string): Promise<ImageInfo | undefined>;
  abstract getImage(fileId: string): Promise<FileInfo | undefined>;

  abstract getLibrary(libraryId: string): Promise<Library | undefined>;

  abstract getShow(showId: string): Promise<SeriesInfo | undefined>;

  abstract getShowEpisode(
    episodeId: string
  ): Promise<ShowEpisodeInfo | undefined>;

  abstract getShowSeason(seasonId: string): Promise<ShowSeasonInfo | undefined>;

  abstract getUser(username: string): Promise<User | undefined>;

  abstract listLibraries(): Promise<Library[]>;

  abstract listShowSeasonEpisodes(seasonId: string): Promise<ShowEpisodeInfo[]>;

  abstract listShowSeasons(showId: string): Promise<ShowSeasonInfo[]>;

  abstract listShows(libraryId: string): Promise<SeriesInfo[]>;

  abstract listUsers(): Promise<User[]>;

  abstract putUser(user: User): Promise<boolean>;

  abstract get sessionStore(): session.Store;

  abstract upsertFile(file: FileInfo): Promise<boolean>;

  abstract upsertImage(image: ImageInfo): Promise<boolean>;

  abstract upsertLibrary(library: Library): Promise<boolean>;

  abstract upsertShow(show: SeriesInfo): Promise<boolean>;

  abstract upsertShowEpisode(episode: ShowEpisodeInfo): Promise<boolean>;

  abstract upsertShowSeason(season: ShowSeasonInfo): Promise<boolean>;
}

export const DatabaseLogger = RootLogger.getChildCategory("Database");
