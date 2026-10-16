import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../env";

export interface Storage {
  readonly kind: "local" | "r2";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Returns a web stream of the object, or null if missing. */
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
  remove(key: string): Promise<void>;
}

/** Keys are generated server-side as `<clientId>/<uuid>`; reject anything else to block traversal. */
const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/;
function assertKey(key: string) {
  if (!KEY_RE.test(key)) throw new Error("invalid storage key");
}

class LocalDiskStorage implements Storage {
  readonly kind = "local" as const;
  constructor(private root: string) {}
  private file(key: string) { assertKey(key); return path.join(path.resolve(this.root), key); }
  async put(key: string, body: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true, mode: 0o700 });
    await writeFile(f, body, { mode: 0o600 });
  }
  async get(key: string) {
    const f = this.file(key);
    try { await stat(f); } catch { return null; }
    return Readable.toWeb(createReadStream(f)) as ReadableStream<Uint8Array>;
  }
  async remove(key: string) { await rm(this.file(key), { force: true }); }
}

class R2Storage implements Storage {
  readonly kind = "r2" as const;
  private s3: S3Client;
  constructor(private cfg: NonNullable<typeof env.r2>) {
    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, body: Buffer, contentType: string) {
    assertKey(key);
    await this.s3.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string) {
    assertKey(key);
    try {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return (r.Body?.transformToWebStream() ?? null) as ReadableStream<Uint8Array> | null;
    } catch { return null; }
  }
  async remove(key: string) {
    assertKey(key);
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  if (!instance) instance = env.r2 ? new R2Storage(env.r2) : new LocalDiskStorage(env.uploadDir);
  return instance;
}
