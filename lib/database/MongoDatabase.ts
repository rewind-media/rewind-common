import { Binary, Collection, Db, MongoClient, UpdateResult } from "mongodb";
import session from "express-session";
import MongoStore from "connect-mongo";
import { randomUUID } from "crypto";
import { hashPassword } from "../util/hash";
import { AbstractDatabase, Database, DatabaseLogger } from "./Database";
import {
  FileInfo,
  ImageInfo,
  Library,
  ShowInfo,
  EpisodeInfo,
  SeasonInfo,
  StreamProps,
  User,
  UserPermissions,
} from "@rewind-media/rewind-protocol";
import _ from "lodash";

export interface MongoClientProps {
  readonly host: string;
  readonly port: number;
  readonly dbName: string;
  readonly username: string;
  readonly password: string;
}

export interface MongoDbProps {
  readonly client: MongoClient;
  readonly dbName: string;
}

interface MongoUser {
  readonly permissions: UserPermissions;
  readonly username: string;
  readonly salt: string;
  readonly hashedPass: Binary;
}

const log = DatabaseLogger.getChildCategory("Mongo");

export class MongoDatabase extends AbstractDatabase {
  private readonly db: Db;
  private readonly mons: Collection<StreamProps>;
  private readonly users: Collection<MongoUser>;
  private readonly client: MongoClient;
  private readonly dbName: string;
  private readonly libraries: Collection<Library>;
  private readonly files: Collection<FileInfo>;
  private readonly shows: Collection<ShowInfo>;
  private readonly showsEpisodes: Collection<EpisodeInfo>;
  private readonly showsSeasons: Collection<SeasonInfo>;
  private readonly images: Collection<ImageInfo>;

  constructor(props: MongoDbProps) {
    super();
    this.dbName = props.dbName;
    this.client = props.client;
    this.db = this.client.db(props.dbName);
    this.mons = this.db.collection<StreamProps>("Monitors");
    this.libraries = this.db.collection<Library>("Libraries");
    this.files = this.db.collection<FileInfo>("Files");
    this.images = this.db.collection<ImageInfo>("Images");
    this.showsEpisodes = this.db.collection<EpisodeInfo>("ShowEpisodes");
    this.showsSeasons = this.db.collection<SeasonInfo>("ShowSeasons");
    this.shows = this.db.collection<ShowInfo>("Shows");
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

  getShow(fileId: string): Promise<ShowInfo | undefined> {
    return this.shows.findOne({ id: fileId }).then((it) => it as ShowInfo);
  }

  getSeason(seasonId: string): Promise<SeasonInfo | undefined> {
    return this.showsSeasons
      .findOne({ id: seasonId })
      .then((it) => it as SeasonInfo);
  }

  getEpisode(episodeId: string): Promise<EpisodeInfo | undefined> {
    return this.showsEpisodes
      .findOne({ id: episodeId })
      .then((it) => it as EpisodeInfo);
  }

  listShows(libraryId: string): Promise<ShowInfo[]> {
    return this.shows
      .find({ libraryName: libraryId })
      .toArray()
      .then((shows) => shows.map((show) => show as ShowInfo));
  }

  listSeasons(showId: string): Promise<SeasonInfo[]> {
    return this.showsSeasons
      .find({ showId: showId })
      .toArray()
      .then((shows) => shows.map((show) => show as SeasonInfo));
  }

  listEpisodes(seasonId: string): Promise<EpisodeInfo[]> {
    return this.showsEpisodes
      .find({ seasonId: seasonId })
      .toArray()
      .then((shows) => shows.map((show) => show as EpisodeInfo));
  }

  upsertShow(show: ShowInfo): Promise<boolean> {
    return this.shows
      .updateOne({ id: show.id }, { $set: show as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  upsertEpisode(episode: EpisodeInfo): Promise<boolean> {
    return this.showsEpisodes
      .updateOne({ id: episode.id }, { $set: episode as any }, { upsert: true })
      .then(
        (result: UpdateResult) =>
          result.upsertedCount + result.modifiedCount === 1
      );
  }

  upsertSeason(season: SeasonInfo): Promise<boolean> {
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
  deleteEpisode(episodeId: string): Promise<boolean> {
    return this.showsEpisodes
      .deleteOne({ id: episodeId })
      .then((it) => it.deletedCount == 1);
  }

  deleteSeason(seasonId: string): Promise<boolean> {
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
  cleanEpisodes(before: Date, libraryName: string): Promise<number> {
    return this.showsEpisodes
      .deleteMany({
        lastUpdated: { $lt: before },
        libraryName: { $eq: libraryName },
      })
      .then((res) => res.deletedCount);
  }

  cleanSeasons(before: Date, libraryName: string): Promise<number> {
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

  override async initialize(): Promise<Database> {
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
      .then(() => super.initialize())
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
