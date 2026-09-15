import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { signedParams } from "@/lib/signing";
import type { StorageDriver } from "./index";

// Development-only storage: the ignore comments stop Vercel from bundling the whole project for these lookups.
export const localRoot = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.localStorageDir);

/** Resolves a storage key inside the upload folder and refuses anything that escapes it. */
export function localPath(key: string) {
  const root = localRoot();
  const full = path.resolve(/*turbopackIgnore: true*/ root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

function signedUrl(key: string, method: "GET" | "PUT", expiresInSec: number) {
  const { exp, sig } = signedParams(key, method, expiresInSec);
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `/api/storage/local/${encoded}?exp=${exp}&sig=${sig}`;
}

export function localDriver(): StorageDriver {
  return {
    name: "local",
    async presignPut(key, contentType, expiresInSec = 3600) {
      return { url: signedUrl(key, "PUT", expiresInSec), headers: { "Content-Type": contentType } };
    },
    async presignGet(key, options = {}) {
      const url = signedUrl(key, "GET", options.expiresInSec ?? 3600);
      return options.filename ? `${url}&download=${encodeURIComponent(options.filename)}` : url;
    },
    async put(key, body) {
      const file = localPath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async getBuffer(key) {
      return readFile(localPath(key));
    },
    async exists(key) {
      try {
        return (await stat(localPath(key))).isFile();
      } catch {
        return false;
      }
    },
    async removePrefix(prefix) {
      await rm(localPath(prefix.replace(/\/$/, "")), { recursive: true, force: true });
    },
    async copy(from, to) {
      const target = localPath(to);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(localPath(from), target);
    },
    async remove(key) {
      await rm(localPath(key), { force: true });
    },
    async usage() {
      let bytes = 0;
      let objects = 0;
      const walk = async (dir: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) await walk(full);
          else if (entry.isFile()) {
            bytes += (await stat(full)).size;
            objects += 1;
          }
        }
      };
      await walk(localRoot());
      return { bytes, objects };
    },
  };
}
