/**
 * Pass 3 of the R2 migration: rewrite src/content/posts/*.md to point at R2.
 *
 *   npx tsx scripts/rewrite-media.ts [--dry-run]
 *
 * Needs MEDIA_BASE_URL in .env.local (e.g. https://media.hudbud.net — no trailing slash).
 *
 * - image/webp/copy outputs: URL swap in place (markdown images, feature_image, <img>, <video>)
 * - gifs that became mp4: `![](x.gif)` becomes the same <video> markup post 47 already uses
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { readManifest, loadEnvLocal, type ManifestEntry } from './media-lib';

loadEnvLocal();

const POSTS_DIR = 'src/content/posts';

function videoTag(url: string, e: ManifestEntry): string {
  const { width, height } = e.video!;
  const aspect = width && height ? `aspect-ratio:${width}/${height};` : '';
  return `<div style="margin:12px 0"><video src="${url}" autoplay muted loop playsinline preload="metadata" style="width:100%;${aspect}height:auto;border-radius:2px;display:block;background:#000"></video></div>`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const base = process.env.MEDIA_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    console.error('MEDIA_BASE_URL not set. Add it to .env.local (e.g. MEDIA_BASE_URL=https://media.hudbud.net)');
    process.exit(1);
  }

  const entries = readManifest().entries;
  const warnings: string[] = [];
  let totalSwaps = 0;

  const mdFiles = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  let rewritten = 0;

  for (const file of mdFiles) {
    const path = join(POSTS_DIR, file);
    const before = readFileSync(path, 'utf-8');
    let content = before;

    for (const e of entries) {
      // Match the raw path or its &amp;-escaped form as it appears in HTML attributes.
      const forms = [...new Set([e.original, e.original.replace(/&/g, '&amp;')])];
      for (const form of forms) {
        if (!content.includes(form)) continue;
        const re = new RegExp(escapeRegExp(form), 'g');

        if (e.action === 'animated') {
          const url = `${base}/${e.video!.key}`;
          // Markdown image of a gif -> inline video element.
          content = content.replace(
            new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(form)}\\)`, 'g'),
            videoTag(url, e),
          );
          // Raw HTML <img> of a gif (with any wrapping div) -> same video element.
          content = content.replace(
            new RegExp(`(?:<div[^>]*>\\s*)?<img[^>]*src="${escapeRegExp(form)}"[^>]*/?>(?:\\s*</div>)?`, 'g'),
            videoTag(url, e),
          );
          if (content.includes(form)) {
            // Leftover = frontmatter feature_image or a bare href; a video URL
            // would break an <img>, so flag it instead of guessing.
            warnings.push(`${file}: ${e.original} became video but is still referenced outside a markdown image`);
            content = content.replace(re, url);
          }
        } else {
          const key = (e.image ?? e.video)!.key;
          content = content.replace(re, `${base}/${key}`);
        }
        totalSwaps++;
      }
    }

    if (content !== before) {
      rewritten++;
      if (!dryRun) writeFileSync(path, content, 'utf-8');
    }
  }

  console.log(`${dryRun ? '[dry run] Would rewrite' : 'Rewrote'} ${rewritten}/${mdFiles.length} files (${totalSwaps} reference swaps).`);

  // Any local /posts/<n>/ path left behind means something wasn't in the
  // manifest. The lookbehind keeps /posts/ inside rewritten absolute URLs
  // (…hudbud.net/posts/…) from matching.
  for (const file of mdFiles) {
    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    for (const m of content.matchAll(/(?<![a-z0-9.])\/posts\/\d+\/[^")\s<>]+/g)) {
      if (!dryRun) warnings.push(`${file}: unmigrated reference ${m[0]}`);
    }
  }

  if (warnings.length) {
    console.warn(`\n⚠ ${warnings.length} warnings:`);
    warnings.forEach((w) => console.warn(`  ${w}`));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
