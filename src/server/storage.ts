/**
 * Video storage via Backblaze B2's S3-compatible API.
 *
 * Replaces local-disk storage, which was being wiped on every Railway
 * redeploy (Railway containers have ephemeral filesystems by default — no
 * persistent volume was attached). B2 storage survives deploys, restarts,
 * and scaling, and RunPod can download directly from the public URL it
 * returns.
 *
 * Required environment variables (set these in Railway → your web service
 * → Variables, after creating the bucket in Backblaze):
 *   B2_KEY_ID          — Application Key ID from B2 → App Keys
 *   B2_APPLICATION_KEY — the matching Application Key secret
 *   B2_BUCKET_NAME     — the bucket name you created
 *   B2_ENDPOINT        — e.g. https://s3.us-west-002.backblazeb2.com
 *                         (shown on the bucket's details page — the region
 *                         code varies depending which B2 region you picked)
 *
 * The bucket must be set to "Public" when you create it in Backblaze's
 * dashboard — otherwise the URL this returns won't be downloadable by
 * RunPod (or playable in the browser) without a signed URL, which this
 * simple version doesn't implement.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const endpoint = process.env.B2_ENDPOINT;

  if (!keyId || !appKey || !endpoint) {
    throw new Error(
      'Backblaze B2 is not configured. Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, and B2_ENDPOINT.'
    );
  }

  client = new S3Client({
    endpoint,
    region: 'auto',
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
  });
  return client;
}

/** Uploads a local file to B2 and returns its public download URL. */
export async function uploadVideoToStorage(localPath: string, key: string): Promise<string> {
  const bucket = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;
  if (!bucket || !endpoint) {
    throw new Error('B2_BUCKET_NAME or B2_ENDPOINT is not set.');
  }

  const s3 = getClient();
  const body = await readFile(localPath);

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: key.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
  }));

  // Public bucket URL format: {endpoint}/{bucket}/{key}
  return `${endpoint}/${bucket}/${key}`;
}
