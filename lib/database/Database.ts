import session from "express-session";
import { RootLogger } from "../util";
import {
  EpisodeInfo,
  FileInfo,
  ImageInfo,
  Library,
  SeasonInfo,
  ShowInfo,
  User,
} from "@rewind-media/rewind-protocol";
import { randomUUID } from "crypto";
import { hashPassword } from "../util";
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

  getFile(fileId: string): Promise<FileInfo | undefined>;
  upsertFile(file: FileInfo): Promise<boolean>;
  deleteFile(fileId: string): Promise<boolean>;
  cleanFiles(before: Date, libraryId: string): Promise<number>;

  listShows(libraryId: string): Promise<ShowInfo[]>;
  listSeasons(showId: string): Promise<SeasonInfo[]>;
  listEpisodes(seasonId: string): Promise<EpisodeInfo[]>;

  getShow(showId: string): Promise<ShowInfo | undefined>;
  getSeason(seasonId: string): Promise<SeasonInfo | undefined>;
  getEpisode(episodeId: string): Promise<EpisodeInfo | undefined>;

  upsertShow(show: ShowInfo): Promise<boolean>;
  upsertSeason(season: SeasonInfo): Promise<boolean>;
  upsertEpisode(episode: EpisodeInfo): Promise<boolean>;

  deleteShow(showId: string): Promise<boolean>;
  deleteSeason(seasonId: string): Promise<boolean>;
  deleteEpisode(episodeId: string): Promise<boolean>;

  cleanShows(before: Date, libraryId: string): Promise<number>;
  cleanSeasons(before: Date, libraryId: string): Promise<number>;
  cleanEpisodes(before: Date, libraryId: string): Promise<number>;
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

  abstract cleanEpisodes(before: Date, libraryId: string): Promise<number>;

  abstract cleanSeasons(before: Date, libraryId: string): Promise<number>;

  abstract cleanShows(before: Date, libraryId: string): Promise<number>;

  abstract deleteFile(fileId: string): Promise<boolean>;

  abstract deleteImage(imageId: string): Promise<boolean>;

  abstract deleteShow(showId: string): Promise<boolean>;

  abstract deleteEpisode(episodeId: string): Promise<boolean>;

  abstract deleteSeason(seasonId: string): Promise<boolean>;

  abstract deleteUser(username: string): Promise<boolean>;

  abstract getImage(imageId: string): Promise<ImageInfo | undefined>;

  abstract getFile(fileId: string): Promise<FileInfo | undefined>;

  abstract getLibrary(libraryId: string): Promise<Library | undefined>;

  abstract getShow(showId: string): Promise<ShowInfo | undefined>;

  abstract getEpisode(episodeId: string): Promise<EpisodeInfo | undefined>;

  abstract getSeason(seasonId: string): Promise<SeasonInfo | undefined>;

  abstract getUser(username: string): Promise<User | undefined>;

  abstract listLibraries(): Promise<Library[]>;

  abstract listEpisodes(seasonId: string): Promise<EpisodeInfo[]>;

  abstract listSeasons(showId: string): Promise<SeasonInfo[]>;

  abstract listShows(libraryId: string): Promise<ShowInfo[]>;

  abstract listUsers(): Promise<User[]>;

  abstract putUser(user: User): Promise<boolean>;

  abstract get sessionStore(): session.Store;

  abstract upsertFile(file: FileInfo): Promise<boolean>;

  abstract upsertImage(image: ImageInfo): Promise<boolean>;

  abstract upsertLibrary(library: Library): Promise<boolean>;

  abstract upsertShow(show: ShowInfo): Promise<boolean>;

  abstract upsertEpisode(episode: EpisodeInfo): Promise<boolean>;

  abstract upsertSeason(season: SeasonInfo): Promise<boolean>;
}

export const DatabaseLogger = RootLogger.getChildCategory("Database");
