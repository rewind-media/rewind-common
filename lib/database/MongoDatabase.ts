import { Binary, Collection, Db, MongoClient, UpdateResult } from "mongodb";
import session from "express-session";
import MongoStore from "connect-mongo";
import { randomUUID } from "crypto";
import { hashPassword } from "../util/hash";
import { Database, DatabaseLogger } from "./Database";
import {
  FileInfo,
  ImageInfo,
  Library,
  LibraryType,
  SeriesInfo,
  ShowEpisodeInfo,
  ShowSeasonInfo,
  StreamProps,
  User,
  UserPermissions,
} from "@rewind-media/rewind-protocol";
import _ from "lodash";

export interface MongoClientProps {
  host: string;
  port: number;
  dbName: string;
  username: string;
  password: string;
}

export interface MongoDbProps {
  client: MongoClient;
  dbName: string;
}

interface MongoUser {
  permissions: UserPermissions;
  username: string;
  salt: string;
  hashedPass: Binary;
}

const log = DatabaseLogger.getChildCategory("Mongo");

export class MongoDatabase implements Database {
  private db: Db;
  private mons: Collection<StreamProps>;
  private users: Collection<MongoUser>;
  private client: MongoClient;
  private dbName: string;
  private libraries: Collection<Library>;
  private files: Collection<FileInfo>;
  private shows: Collection<SeriesInfo>;
  private showsEpisodes: Collection<ShowEpisodeInfo>;
  private showsSeasons: Collection<ShowSeasonInfo>;
  private images: Collection<ImageInfo>;

  constructor(props: MongoDbProps) {
    this.dbName = props.dbName;
    this.client = props.client;
    this.db = this.client.db(props.dbName);
    this.mons = this.db.collection<StreamProps>("Monitors");
    this.libraries = this.db.collection<Library>("Libraries");
    this.files = this.db.collection<FileInfo>("Files");
    this.images = this.db.collection<ImageInfo>("Images");
    this.showsEpisodes = this.db.collection<ShowEpisodeInfo>("ShowEpisodes");
    this.showsSeasons = this.db.collection<ShowSeasonInfo>("ShowSeasons");
    this.shows = this.db.collection<SeriesInfo>("Shows");
    this.users = this.db.collection<MongoUser>("Users");
  }

  // Users
  getUser(username: string): Promise<User | undefined> {
    return this.users
      .find({ username: username })
      .toArray()
      .then((x) => _.first(x))
      .then((x) => (x ? MongoDatabase.toUser(x) : undefined));
  }

  putUser(user: User): Promise<boolean> {
    const mUser = MongoDatabase.toMongoUser(user);
    return this.users
      .updateOne({ name: mUser.username }, { $set: mUser }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  listUsers(): Promise<User[]> {
    return this.users.find({}).map(MongoDatabase.toUser).toArray();
  }

  deleteUser(username: string): Promise<boolean> {
    return this.users
      .deleteOne({ username: username })
      .then((res) => res.deletedCount == 1);
  }

  // Libraries
  getLibrary(libraryName: string): Promise<Library | undefined> {
    return this.libraries
      .findOne({ name: libraryName })
      .then((it) => it as Library);
  }

  listLibraries(): Promise<Library[]> {
    return this.libraries
      .find()
      .toArray()
      .then((libraries) => libraries.map((it) => it as Library));
  }

  upsertLibrary(library: Library): Promise<boolean> {
    return this.libraries
      .updateOne(
        { name: library.name },
        { $set: library as any },
        { upsert: true }
      )
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  // Files
  getFile(fileId: string): Promise<FileInfo | undefined> {
    return this.files.find({ id: fileId }).toArray().then(_.first);
  }

  upsertFile(file: FileInfo): Promise<boolean> {
    return this.files
      .updateOne({ id: file.id }, { $set: file as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  deleteFile(fileId: string): Promise<boolean> {
    return this.files
      .deleteOne({ id: fileId })
      .then((it) => it.deletedCount == 1);
  }

  cleanFiles(before: Date, libraryName: string): Promise<number> {
    return this.files
      .deleteMany({
        lastUpdated: { $lt: before },
        libraryName: { $eq: libraryName },
      })
      .then((res) => res.deletedCount);
  }

  // Images
  getImage(imageId: string): Promise<ImageInfo | undefined> {
    return this.images.find({ id: imageId }).toArray().then(_.first);
  }

  upsertImage(image: ImageInfo): Promise<boolean> {
    return this.images
      .updateOne({ id: image.id }, { $set: image as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  deleteImage(imageId: string): Promise<boolean> {
    return this.images
      .deleteOne({ id: imageId })
      .then((it) => it.deletedCount == 1);
  }

  cleanImages(before: Date, libraryName: string): Promise<number> {
    return this.images
      .deleteMany({
        lastUpdated: { $lt: before },
        libraryName: { $eq: libraryName },
      })
      .then((res) => res.deletedCount);
  }

  // Shows

  getShow(fileId: string): Promise<SeriesInfo | undefined> {
    return this.shows.findOne({ id: fileId }).then((it) => it as SeriesInfo);
  }

  getShowSeason(seasonId: string): Promise<ShowSeasonInfo | undefined> {
    return this.showsSeasons
      .findOne({ id: seasonId })
      .then((it) => it as ShowSeasonInfo);
  }

  getShowEpisode(episodeId: string): Promise<ShowEpisodeInfo | undefined> {
    return this.showsEpisodes
      .findOne({ id: episodeId })
      .then((it) => it as ShowEpisodeInfo);
  }

  listShows(libraryId: string): Promise<SeriesInfo[]> {
    return this.shows
      .find({ libraryName: libraryId })
      .toArray()
      .then((shows) => shows.map((show) => show as SeriesInfo));
  }

  listShowSeasons(showId: string): Promise<ShowSeasonInfo[]> {
    return this.showsSeasons
      .find({ showId: showId })
      .toArray()
      .then((shows) => shows.map((show) => show as ShowSeasonInfo));
  }

  listShowSeasonEpisodes(seasonId: string): Promise<ShowEpisodeInfo[]> {
    return this.showsEpisodes
      .find({ seasonId: seasonId })
      .toArray()
      .then((shows) => shows.map((show) => show as ShowEpisodeInfo));
  }

  upsertShow(show: SeriesInfo): Promise<boolean> {
    return this.shows
      .updateOne({ id: show.id }, { $set: show as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  upsertShowEpisode(episode: ShowEpisodeInfo): Promise<boolean> {
    return this.showsEpisodes
      .updateOne({ id: episode.id }, { $set: episode as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  upsertShowSeason(season: ShowSeasonInfo): Promise<boolean> {
    return this.showsSeasons
      .updateOne({ id: season.id }, { $set: season as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  deleteShow(fileId: string): Promise<boolean> {
    return this.shows
      .deleteOne({ id: fileId })
      .then((it) => it.deletedCount == 1);
  }
  deleteShowEpisode(episodeId: string): Promise<boolean> {
    return this.showsEpisodes
      .deleteOne({ id: episodeId })
      .then((it) => it.deletedCount == 1);
  }

  deleteShowSeason(seasonId: string): Promise<boolean> {
    return this.showsSeasons
      .deleteOne({ id: seasonId })
      .then((it) => it.deletedCount == 1);
  }

  cleanShows(before: Date, libraryName: string): Promise<number> {
    return this.shows
      .deleteMany({
        lastUpdated: { $lt: before },
        libraryName: { $eq: libraryName },
      })
      .then((res) => res.deletedCount);
  }
  cleanShowEpisodes(before: Date, libraryName: string): Promise<number> {
    return this.showsEpisodes
      .deleteMany({
        lastUpdated: { $lt: before },
        libraryName: { $eq: libraryName },
      })
      .then((res) => res.deletedCount);
  }

  cleanShowSeasons(before: Date, libraryName: string): Promise<number> {
    return this.showsSeasons
      .deleteMany({
        lastUpdated: { $lt: before },
        libraryName: { $eq: libraryName },
      })
      .then((res) => res.deletedCount);
  }

  // Initialization
  get sessionStore(): session.Store {
    return MongoStore.create({ client: this.client, dbName: this.dbName });
  }

  async initialize(): Promise<Database> {
    return Promise.all([this.mons.createIndex({ name: 1 }, { unique: true })])
      .then(() => log.info("MongoDb initialized"))
      .then(() => this.listUsers())
      .then((userArr) => {
        if (_.isEmpty(userArr)) {
          const username = "rewind-" + randomUUID();
          const password = randomUUID();
          const salt = randomUUID();
          log.info(
            `Created initial Rewind user. Username: '${username}', Password: '${password}'`
          );
          return hashPassword(password, salt).then((hashedPass) => {
            this.putUser({
              username: username,
              hashedPass: hashedPass,
              salt: salt,
              permissions: {
                isAdmin: true,
              },
            });
          });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => this.listLibraries())
      .then((libs) => {
        if (_.isEmpty(libs)) {
          return this.upsertLibrary({
            name: "test",
            rootPaths: ["/home/kenny/Desktop/CYE"],
            type: LibraryType.Show,
          });
        } else {
          return new Promise((resolve) => resolve(false));
        }
      })
      .then(() => this);
  }

  // Statics
  private static toMongoUser(user: User): MongoUser {
    return {
      username: user.username,
      salt: user.salt,
      hashedPass: new Binary(user.hashedPass),
      permissions: user.permissions,
    };
  }

  private static toUser(mUser: MongoUser): User {
    return {
      username: mUser.username,
      salt: mUser.salt,
      hashedPass: mUser.hashedPass.buffer,
      permissions: mUser.permissions,
    };
  }
}

export function mkMongoDatabase(props: MongoClientProps): Promise<Database> {
  const username = encodeURIComponent(props.username);
  const password = encodeURIComponent(props.password);
  const authMechanism = "DEFAULT";
  const uri = `mongodb://${username}:${password}@${props.host}:${props.port}/?authMechanism=${authMechanism}`;
  return new MongoClient(uri)
    .connect()
    .then(
      (client) => new MongoDatabase({ client: client, dbName: props.dbName })
    )
    .then((db) => db.initialize());
}