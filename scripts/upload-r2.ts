/**
 * Pass 2 of the R2 migration: upload everything in media-out/manifest.json to R2.
 *
 *   npx tsx scripts/upload-r2.ts [--dry-run]
 *
 * Needs in .env.local:
 *   R2_ACCOUNT_ID     Cloudflare account id (dashboard -> R2 -> API)
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   from an R2 API token
 *   R2_BUCKET         bucket name
 *
 * Idempotent: objects whose size already matches on R2 are skipped.
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join, extname } from 'path';
import { MEDIA_OUT, readManifest, loadEnvLocal, pool, fmtMB, type Variant } from './media-lib';

loadEnvLocal();

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!dryRun && (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET)) {
    console.error('Missing R2 env vars. Add to .env.local: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
    process.exit(1);
  }

  const variants: Variant[] = readManifest().entries.flatMap((e) => [e.image, e.video]).filter((v): v is Variant => !!v);
  const totalBytes = variants.reduce((s, v) => s + v.bytes, 0);
  console.log(`${variants.length} objects, ${fmtMB(totalBytes)} total${dryRun ? ' (dry run)' : ''}`);
  if (dryRun) {
    variants.slice(0, 20).forEach((v) => console.log(`  ${v.key} (${fmtMB(v.bytes)})`));
    if (variants.length > 20) console.log(`  ... and ${variants.length - 20} more`);
    return;
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
  });

  let uploaded = 0, skipped = 0;
  const errors: string[] = [];
  await pool(variants, 8, async (v) => {
    try {
      try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: v.key }));
        if (head.ContentLength === v.bytes) { skipped++; return; }
      } catch { /* not there yet */ }
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: v.key,
        Body: readFileSync(join(MEDIA_OUT, v.key)),
        ContentType: CONTENT_TYPES[extname(v.key)] ?? 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      uploaded++;
      if ((uploaded + skipped) % 100 === 0) console.log(`  ${uploaded + skipped}/${variants.length}`);
    } catch (err: any) {
      errors.push(`${v.key}: ${err.message}`);
    }
  });

  console.log(`\nUploaded ${uploaded}, skipped ${skipped} already present.`);
  if (errors.length) {
    console.error(`✗ ${errors.length} failures:`);
    errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
