import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';

const cfg = config.storage;
const enabled = cfg.driver === 's3' && Boolean(cfg.s3.endpoint && cfg.s3.bucket && cfg.s3.accessKey && cfg.s3.secretKey);

const client = enabled
  ? new S3Client({
      endpoint: cfg.s3.endpoint,
      region: cfg.s3.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.s3.accessKey,
        secretAccessKey: cfg.s3.secretKey,
      },
    })
  : null;

export function s3Enabled() {
  return enabled;
}

export async function saveObject(key, body, contentType) {
  if (!enabled) return false;
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'max-age=604800',
    }),
  );
  return true;
}

export async function getObject(key) {
  if (!enabled) return null;
  try {
    const obj = await client.send(new GetObjectCommand({ Bucket: cfg.s3.bucket, Key: key }));
    return { stream: obj.Body, contentType: obj.ContentType };
  } catch {
    return null;
  }
}