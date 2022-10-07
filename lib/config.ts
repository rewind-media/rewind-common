import conf from "config";
import { MongoClientProps } from "./database";
import { RedisOptions } from "ioredis/built/redis/RedisOptions";

type DbConfig = MongoClientProps;
type CacheConfig = RedisOptions;
export interface Config {
  databaseConfig: DbConfig;
  cacheConfig: CacheConfig;
}

export function loadConfig(): Config {
  return {
    databaseConfig: loadDbConfig(),
    cacheConfig: loadCacheConfig(),
  };
}

export function loadDbConfig(): DbConfig {
  if (conf.has("mongoDb")) {
    return {
      dbName: conf.get("mongoDb.dbName"),
      username: conf.get("mongoDb.username"),
      password: conf.get("mongoDb.password"),
      port: conf.get("mongoDb.port"),
      host: conf.get("mongoDb.host"),
    };
  } else throw "Missing required database config!";
}

export function loadCacheConfig(): CacheConfig {
  if (conf.has("redis")) {
    return {
      port: optional("redis.port"),
      host: optional("redis.host"),
      username: optional("redis.username"),
      password: optional("redis.password"),
      db: optional("redis.db"),
    };
  } else throw "Missing required cache config!";
}

function optional<T>(path: string): T | undefined {
  return conf.has(path) ? conf.get<T>(path) : undefined;
}
