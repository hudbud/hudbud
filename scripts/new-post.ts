/**
 * Create a new post: optimize images locally, upload them to R2, write markdown.
 *
 *   npx tsx scripts/new-post.ts --title "Trip Name" --tag life --images ~/Photos/folder/
 *
 * Needs the same .env.local vars as the migration scripts:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, MEDIA_BASE_URL
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdtempSync, statSync } from 'fs';
import { join, extname } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { loadEnvLocal, sanitizeName, fmtMB } from './media-lib';

const run = promisify(execFile);

const USAGE = `
Usage: npx tsx scripts/new-post.ts --title "Trip Name" --tag life --images ~/Photos/folder/

Options:
  --title    Post title (required)
  --tag      Post tag: thoughts, life, or resources (default: life)
  --images   Directory of images to include (required)
  --body     Optional markdown body file
  --excerpt  Short excerpt
  --date     Date string (default: today)
  --draft    Mark as draft
  --help     Show this help

What it does:
  1. Optimizes images (webp, max 2400px; mp4/mov re-encoded; heic converted)
  2. Uploads them to R2 under posts/<slug>/
  3. Writes src/content/posts/<slug>.md pointing at MEDIA_BASE_URL
`;

const STILL_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov']);
const GIF_EXTS = new Set(['.gif']);
const ALL_EXTS = new Set([...STILL_EXTS, ...VIDEO_EXTS, ...GIF_EXTS]);

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (key === 'help' || key === 'draft') result[key] = 'true';
      else result[key] = args[++i] || '';
    }
  }
  return result;
}

interface Uploaded {
  url: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); process.exit(0); }
  if (!args.title || !args.images) {
    console.error('Need at least --title and --images. Use --help for usage.');
    process.exit(1);
  }
  const tag = args.tag || 'life';
  if (!['thoughts', 'life', 'resources'].includes(tag)) {
    console.error('Tag must be one of: thoughts, life, resources');
    process.exit(1);
  }
  if (!existsSync(args.images)) {
    console.error(`Directory not found: ${args.images}`);
    process.exit(1);
  }

  loadEnvLocal();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, MEDIA_BASE_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !MEDIA_BASE_URL) {
    console.error('Missing env vars in .env.local: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, MEDIA_BASE_URL');
    process.exit(1);
  }
  const base = MEDIA_BASE_URL.replace(/\/$/, '');

  const slug = slugify(args.title);
  const outPath = join('src', 'content', 'posts', `${slug}.md`);
  if (existsSync(outPath)) {
    console.error(`${outPath} already exists.`);
    process.exit(1);
  }

  const files = readdirSync(args.images)
    .filter((f) => ALL_EXTS.has(extname(f).toLowerCase()))
    .sort();
  if (files.length === 0) {
    console.error(`No image/video files found in ${args.images}`);
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  const tmp = mkdtempSync(join(tmpdir(), 'new-post-'));
  const uploads: Uploaded[] = [];
  console.log(`Optimizing + uploading ${files.length} files to posts/${slug}/ ...`);

  for (const file of files) {
    const src = join(args.images, file);
    const ext = extname(file).toLowerCase();
    const stem = sanitizeName(file).replace(/\.[^.]+$/, '');
    let local: string;
    let key: string;
    let kind: Uploaded['kind'];
    let width: number | undefined;
    let height: number | undefined;

    if (VIDEO_EXTS.has(ext) || GIF_EXTS.has(ext)) {
      key = `posts/${slug}/${stem}.mp4`;
      local = join(tmp, `${stem}.mp4`);
      await run('ffmpeg', [
        '-y', '-v', 'error', '-i', src,
        '-movflags', 'faststart', '-pix_fmt', 'yuv420p',
        '-vf', "scale=w='min(1920,trunc(iw/2)*2)':h=-2",
        '-c:v', 'libx264', '-crf', '26', '-preset', 'medium',
        '-c:a', 'aac', '-b:a', '128k',
        local,
      ]);
      const { stdout } = await run('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height', '-of', 'csv=p=0', local,
      ]);
      [width, height] = stdout.trim().split(',').map(Number);
      kind = 'video';
    } else {
      key = `posts/${slug}/${stem}.webp`;
      local = join(tmp, `${stem}.webp`);
      await sharp(src, { limitInputPixels: false })
        .rotate()
        .resize({ width: 2400, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(local);
      kind = 'image';
    }

    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: readFileSync(local),
      ContentType: kind === 'video' ? 'video/mp4' : 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    uploads.push({ url: `${base}/${key}`, kind, width, height });
    console.log(`  ✓ ${file} → ${key} (${fmtMB(statSync(local).size)})`);
  }

  const date = args.date || new Date().toISOString().slice(0, 10);
  const featureImage = uploads.find((u) => u.kind === 'image')?.url;

  let body = '';
  if (args.body && existsSync(args.body)) {
    body = readFileSync(args.body, 'utf-8');
  } else {
    body = uploads.map((u) => {
      if (u.kind === 'video') {
        const aspect = u.width && u.height ? `aspect-ratio:${u.width}/${u.height};` : '';
        return `<div style="margin:12px 0"><video src="${u.url}" autoplay muted loop playsinline preload="metadata" style="width:100%;${aspect}height:auto;border-radius:2px;display:block;background:#000"></video></div>`;
      }
      return `![](${u.url})`;
    }).join('\n\n');
  }

  const frontmatter = [
    '---',
    `title: "${args.title}"`,
    `date: "${date}"`,
    `tags: ["${tag}"]`,
    args.excerpt ? `excerpt: "${args.excerpt}"` : null,
    featureImage ? `feature_image: "${featureImage}"` : null,
    args.draft ? 'draft: true' : null,
    '---',
  ].filter(Boolean).join('\n');

  writeFileSync(outPath, `${frontmatter}\n\n${body}\n`, 'utf-8');

  console.log(`\n✓ Done!`);
  console.log(`  Post: ${outPath}`);
  console.log(`  Media: ${uploads.length} files at ${base}/posts/${slug}/`);
  console.log(`\n  Run "npm run dev" and it'll show up in the gallery + post list.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
