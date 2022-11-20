import { isLocalPath, FileLocation } from "@rewind-media/rewind-protocol";
import { createReadStream } from "fs";
import { Readable } from "stream";

export function getFile(location: FileLocation): Promise<Readable> {
  if (isLocalPath(location)) {
    return Promise.resolve(createReadStream(location.localPath));
  } else {
    throw `Unsupported location type: ${location}`;
  }
}

export const readFile = async (readable: Readable) =>
  new Promise<Buffer>((resolve, reject) => {
    try {
      const buffs: Uint8Array[] = [];
      readable.on("data", (it: Uint8Array) => buffs.push(it));
      readable.on("close", () => {
        resolve(Buffer.concat(buffs));
      });
    } catch (e) {
      reject(e);
    }
  });
