/**
 * Pass 1 of the R2 migration: optimize every referenced asset in public/posts/
 * into media-out/, writing media-out/manifest.json for the upload + rewrite steps.
 *
 *   npx tsx scripts/optimize-media.ts
 *
 * Rules:
 *   jpg/jpeg/png/webp  -> webp (max 2400px wide, q82); original kept if webp comes out bigger
 *   gif                -> animated webp if that lands under 2.5MB, else mp4 (rewritten to <video>)
 *   mp4                -> re-encoded (crf 26, max 1920px); original kept unless we save >=10%
 *
 * Idempotent: existing outputs in media-out/ are reused, so re-runs are fast.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import sharp from 'sharp';
import {
  MEDIA_OUT, MANIFEST_PATH, collectReferencedPaths, sanitizeName, pool, fmtMB,
  type Manifest, type ManifestEntry, type Variant,
} from './media-lib';

const run = promisify(execFile);

const STILL_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_STILL_WIDTH = 2400;
const MAX_VIDEO_WIDTH = 1920;
/** Animated gifs whose webp lands under this stay <img>-compatible; bigger ones become <video>. */
const GIF_WEBP_LIMIT = 2.5 * 1024 * 1024;

async function probeDims(file: string): Promise<{ width: number; height: number } | undefined> {
  try {
    const { stdout } = await run('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file,
    ]);
    const [w, h] = stdout.trim().split(',').map(Number);
    if (w && h) return { width: w, height: h };
  } catch { /* dimensions are optional */ }
  return undefined;
}

function variant(key: string, dims?: { width: number; height: number }): Variant {
  return { key, bytes: statSync(join(MEDIA_OUT, key)).size, ...dims };
}

function outPath(key: string): string {
  const p = join(MEDIA_OUT, key);
  mkdirSync(dirname(p), { recursive: true });
  return p;
}

/** Re-encode to h264 mp4; returns false if the source is smaller and should be copied. */
async function encodeVideo(src: string, dest: string, requireSavings: boolean): Promise<boolean> {
  const tmp = dest + '.tmp.mp4';
  await run('ffmpeg', [
    '-y', '-v', 'error', '-i', src,
    '-movflags', 'faststart', '-pix_fmt', 'yuv420p',
    '-vf', `scale=w='min(${MAX_VIDEO_WIDTH},trunc(iw/2)*2)':h=-2`,
    '-c:v', 'libx264', '-crf', '26', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '128k',
    tmp,
  ]);
  const saved = statSync(src).size - statSync(tmp).size;
  if (requireSavings && saved < statSync(src).size * 0.1) {
    await run('rm', [tmp]);
    copyFileSync(src, dest);
    return false;
  }
  await run('mv', [tmp, dest]);
  return true;
}

async function processOne(original: string, disambiguate: boolean): Promise<ManifestEntry> {
  const src = join('public', original);
  const ext = extname(original).toLowerCase();
  const originalBytes = statSync(src).size;
  const dir = dirname(original).slice(1); // "posts/45"
  const base = sanitizeName(original.split('/').pop()!);
  // "image-asset.gif" and "image-asset.jpeg" in one post would both want
  // image-asset.webp — fold the source extension in when stems collide.
  const stem = base.slice(0, base.lastIndexOf('.')) + (disambiguate ? '-' + ext.slice(1) : '');

  if (STILL_EXTS.has(ext)) {
    const key = `${dir}/${stem}.webp`;
    const dest = outPath(key);
    if (!existsSync(dest)) {
      await sharp(src, { limitInputPixels: false })
        .rotate()
        .resize({ width: MAX_STILL_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(dest);
    }
    if (statSync(dest).size < originalBytes) {
      return { original, originalBytes, action: 'still', image: variant(key) };
    }
    // webp didn't help (already-optimized webp/small png) — ship the original bytes
    const copyKey = `${dir}/${base}`;
    if (!existsSync(join(MEDIA_OUT, copyKey))) copyFileSync(src, outPath(copyKey));
    return { original, originalBytes, action: 'copy', image: variant(copyKey) };
  }

  if (ext === '.gif') {
    const webpKey = `${dir}/${stem}.webp`;
    const webpDest = outPath(webpKey);
    if (!existsSync(webpDest)) {
      await sharp(src, { animated: true, limitInputPixels: false })
        .webp({ quality: 75, effort: 4 })
        .toFile(webpDest);
    }
    if (statSync(webpDest).size <= GIF_WEBP_LIMIT) {
      return { original, originalBytes, action: 'still', image: variant(webpKey) };
    }
    const mp4Key = `${dir}/${stem}.mp4`;
    const mp4Dest = outPath(mp4Key);
    if (!existsSync(mp4Dest)) await encodeVideo(src, mp4Dest, false);
    return { original, originalBytes, action: 'animated', video: variant(mp4Key, await probeDims(mp4Dest)) };
  }

  if (ext === '.mp4' || ext === '.mov') {
    const key = `${dir}/${stem}.mp4`;
    const dest = outPath(key);
    if (!existsSync(dest)) await encodeVideo(src, dest, true);
    return { original, originalBytes, action: 'video', video: variant(key, await probeDims(dest)) };
  }

  // Unknown type — pass the bytes through untouched.
  const copyKey = `${dir}/${base}`;
  if (!existsSync(join(MEDIA_OUT, copyKey))) copyFileSync(src, outPath(copyKey));
  return { original, originalBytes, action: 'copy', image: variant(copyKey) };
}

async function main() {
  // Only per-post assets move to R2; the graph-*.jpg OG images referenced from
  // code stay in public/ (they're 3 files and Layout.astro points at them).
  const referenced = [...collectReferencedPaths()].sort();
  const missing = referenced.filter((p) => !existsSync(join('public', p)));
  if (missing.length) {
    console.warn(`⚠ ${missing.length} referenced files missing on disk:`);
    missing.forEach((p) => console.warn(`  ${p}`));
  }
  const todo = referenced.filter((p) => existsSync(join('public', p)));
  console.log(`Processing ${todo.length} referenced assets...`);

  // Two sources whose sanitized stems match (image-asset.gif + image-asset.jpeg)
  // would fight over one output key — those get the source extension folded in.
  const stemOf = (p: string) => {
    const base = sanitizeName(p.split('/').pop()!);
    return dirname(p) + '/' + base.slice(0, base.lastIndexOf('.'));
  };
  const stemCounts = new Map<string, number>();
  for (const p of todo) stemCounts.set(stemOf(p), (stemCounts.get(stemOf(p)) ?? 0) + 1);

  // Guard against two source names sanitizing to the same output key.
  const keyOwners = new Map<string, string>();

  const errors: string[] = [];
  let done = 0;
  const entries = (await pool(todo, 4, async (original) => {
    try {
      const entry = await processOne(original, (stemCounts.get(stemOf(original)) ?? 0) > 1);
      for (const v of [entry.image, entry.video]) {
        if (!v) continue;
        const owner = keyOwners.get(v.key);
        if (owner && owner !== original) errors.push(`key collision: ${original} and ${owner} both -> ${v.key}`);
        keyOwners.set(v.key, original);
      }
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${todo.length}`);
      return entry;
    } catch (err: any) {
      errors.push(`${original}: ${err.message}`);
      return null;
    }
  })).filter((e): e is ManifestEntry => e !== null);

  const manifest: Manifest = { entries };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const inBytes = entries.reduce((s, e) => s + e.originalBytes, 0);
  const outBytes = entries.reduce((s, e) => s + (e.image?.bytes ?? 0) + (e.video?.bytes ?? 0), 0);
  const byAction = entries.reduce<Record<string, number>>((acc, e) => ((acc[e.action] = (acc[e.action] ?? 0) + 1), acc), {});
  console.log(`\n${entries.length} assets: ${fmtMB(inBytes)} -> ${fmtMB(outBytes)}`);
  console.log(Object.entries(byAction).map(([k, v]) => `${k}: ${v}`).join(', '));
  console.log(`Manifest written to ${MANIFEST_PATH}`);

  if (errors.length) {
    console.error(`\n✗ ${errors.length} errors:`);
    errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
