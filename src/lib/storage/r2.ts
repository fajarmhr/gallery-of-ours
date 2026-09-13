import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type { StorageDriver } from "./index";

/** Signing time is rounded to 30 minutes so presigned GET URLs stay stable and cacheable. */
const bucketedSigningDate = () => new Date(Math.floor(Date.now() / 1_800_000) * 1_800_000);

export function r2Driver(): StorageDriver {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.r2.accessKeyId!, secretAccessKey: env.r2.secretAccessKey! },
    // Browsers can't send the checksum headers newer SDK versions add to presigned uploads.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = env.r2.bucket!;

  return {
    name: "r2",
    async presignPut(key, contentType, expiresInSec = 3600) {
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
        expiresIn: expiresInSec,
      });
      return { url, headers: { "Content-Type": contentType } };
    },
    async presignGet(key, options = {}) {
      const command = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseCacheControl: "private, max-age=3600",
        ResponseContentDisposition: options.filename
          ? `attachment; filename*=UTF-8''${encodeURIComponent(options.filename)}`
          : undefined,
      });
      return getSignedUrl(client, command, {
        expiresIn: (options.expiresInSec ?? 3600) + 1800,
        signingDate: bucketedSigningDate(),
      });
    },
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async getBuffer(key) {
      const result = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!result.Body) throw new Error(`Object ${key} has no body`);
      return Buffer.from(await result.Body.transformToByteArray());
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    async removePrefix(prefix) {
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
        const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
        if (keys.length) await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }));
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    },
  };
}
