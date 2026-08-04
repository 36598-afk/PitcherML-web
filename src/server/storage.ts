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

  const keyId = process.env.B2_KEY_ID?.trim();
  const appKey = process.env.B2_APPLICATION_KEY?.trim();
  const endpoint = process.env.B2_ENDPOINT?.trim();

  if (!keyId || !appKey || !endpoint) {
    throw new Error(
      'Backblaze B2 is not configured. Set B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, and B2_ENDPOINT.'
    );
  }

  // Diagnostic — logs the exact values being used (key/secret only as
  // length + first/last char, never the real value) so a malformed
  // endpoint or stray whitespace shows up directly in the deploy logs
  // instead of us guessing blind.
  console.log('[B2 config]', {
    endpoint: JSON.stringify(endpoint),           // JSON.stringify reveals hidden whitespace/quotes
    endpointLength: endpoint.length,
    bucket: JSON.stringify(process.env.B2_BUCKET_NAME?.trim()),
    keyIdPreview: keyId ? `${keyId.slice(0, 4)}…${keyId.slice(-4)} (len ${keyId.length})` : 'MISSING',
    appKeyLength: appKey.length,
  });

  let validatedEndpoint: string;
  try {
    validatedEndpoint = new URL(endpoint).toString().replace(/\/$/, '');
  } catch (e) {
    throw new Error(
      `B2_ENDPOINT is not a valid URL: ${JSON.stringify(endpoint)}. It must look like ` +
      `"https://s3.us-west-002.backblazeb2.com" (no trailing slash, no quotes, no extra spaces). ` +
      `Underlying error: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const regionMatch = validatedEndpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  const region = regionMatch ? regionMatch[1] : 'us-east-1';
  console.log('[B2 config] resolved', { validatedEndpoint, region });

  client = new S3Client({
    endpoint: validatedEndpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
  });
  return client;
}

/** Uploads a local file to B2 and returns its public download URL. */
export async function uploadVideoToStorage(localPath: string, key: string): Promise<string> {
  const bucket = process.env.B2_BUCKET_NAME?.trim();
  const endpoint = process.env.B2_ENDPOINT?.trim();
  if (!bucket || !endpoint) {
    throw new Error('B2_BUCKET_NAME or B2_ENDPOINT is not set.');
  }

  const s3 = getClient();
  const body = await readFile(localPath);

  console.log('[B2 upload] attempting', { bucket, key, bytes: body.length });

  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: key.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
    }));
  } catch (e) {
    console.log('[B2 upload] PutObjectCommand failed', {
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : undefined,
      stack: e instanceof Error ? e.stack : undefined,
    });
    throw e;
  }

  console.log('[B2 upload] success', { bucket, key });

  // Public bucket URL format: {endpoint}/{bucket}/{key}
  return `${endpoint}/${bucket}/${key}`;
}
