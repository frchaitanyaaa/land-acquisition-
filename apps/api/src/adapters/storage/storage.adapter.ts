import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { repoRoot } from '@bhoomisetu/db';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

/** Object storage (§30 StorageAdapter). S3/MinIO in compose; a local directory where MinIO is absent. */
export interface StorageAdapter {
  readonly provider: 's3' | 'local';
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Short-TTL presigned GET, or null when the API must stream the object itself. */
  presign(key: string, filename: string): Promise<string | null>;
}

@Injectable()
export class StorageService implements StorageAdapter {
  private readonly logger = new Logger('Storage');
  readonly provider = env().STORAGE_PROVIDER;
  private s3?: S3Client;
  private bucketChecked = false;

  private client(): S3Client {
    const e = env();
    this.s3 ??= new S3Client({
      endpoint: e.S3_ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
    });
    return this.s3;
  }

  private localPath(key: string): string {
    const dir = env().STORAGE_LOCAL_DIR;
    const base = isAbsolute(dir) ? dir : join(repoRoot(), dir);
    const p = resolve(base, key);
    if (!p.startsWith(resolve(base))) throw new Error('object key escapes the storage directory');
    return p;
  }

  private async ensureBucket() {
    if (this.bucketChecked) return;
    const Bucket = env().S3_BUCKET;
    try {
      await this.client().send(new HeadBucketCommand({ Bucket }));
    } catch {
      this.logger.warn(`creating bucket ${Bucket}`);
      await this.client().send(new CreateBucketCommand({ Bucket }));
    }
    this.bucketChecked = true;
  }

  async put(key: string, body: Buffer, mime: string) {
    if (this.provider === 'local') {
      const p = this.localPath(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
      return;
    }
    await this.ensureBucket();
    await this.client().send(
      new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Body: body, ContentType: mime }),
    );
  }

  async get(key: string): Promise<Buffer> {
    if (this.provider === 'local') return readFile(this.localPath(key));
    const r = await this.client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray()); // Body is always set on a successful GET
  }

  async presign(key: string, filename: string): Promise<string | null> {
    if (this.provider === 'local') return null;
    return getSignedUrl(
      this.client(),
      new GetObjectCommand({
        Bucket: env().S3_BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
      { expiresIn: env().S3_PRESIGN_TTL_SECONDS },
    );
  }
}
