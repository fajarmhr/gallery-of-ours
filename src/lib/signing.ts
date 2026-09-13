import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "@/lib/env";

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

export function sign(payload: string) {
  return createHmac("sha256", env.signingSecret).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Expiry is rounded up to a 30-minute bucket so the same URL is reused and browsers can cache it. */
export function signedParams(key: string, method: "GET" | "PUT", expiresInSec: number) {
  const bucket = 30 * 60;
  const exp = Math.ceil((Date.now() / 1000 + expiresInSec) / bucket) * bucket;
  return { exp: String(exp), sig: sign(`${method}:${key}:${exp}`) };
}

export function verifySignedParams(key: string, method: "GET" | "PUT", exp: string | null, sig: string | null) {
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  return safeEqual(sign(`${method}:${key}:${exp}`), sig);
}

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(secret, salt, 32);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifySecret(secret: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = await scrypt(secret, salt, 32);
  return safeEqual(candidate.toString("hex"), hash);
}

export const randomToken = (bytes = 18) => randomBytes(bytes).toString("base64url");
