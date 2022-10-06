import { promisify } from "util";
import crypto from "crypto";

const hashFunc = promisify(crypto.pbkdf2);

export function hashPassword(password: string, salt: string): Promise<Buffer> {
  return hashFunc(password, salt, 310000, 32, "sha256");
}

export function mkFileId(path: string, libraryId: string): string {
  return crypto.createHash("md5").update(path).update(libraryId).digest("hex");
}

