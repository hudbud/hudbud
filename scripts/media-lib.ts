import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

export const MEDIA_OUT = 'media-out';
export const MANIFEST_PATH = join(MEDIA_OUT, 'manifest.json');

export interface Variant {
  /** R2 object key, e.g. "posts/45/bigsur-35.webp" */
  key: string;
  bytes: number;
  width?: number;
  height?: number;
}

export interface ManifestEntry {
  /** Original site path as referenced in markdown, e.g. "/posts/45/bigsur-35.jpg" */
  original: string;
  originalBytes: number;
  /** still = image→webp, animated = gif→mp4(+webp), video = mp4 re-encode, copy = kept as-is */
  action: 'still' | 'animated' | 'video' | 'copy';
  /** <img>-compatible output (webp or copied original) */
  image?: Variant;
  /** <video>-compatible output */
  video?: Variant;
}

export interface Manifest {
  entries: ManifestEntry[];
}

export function readManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`${MANIFEST_PATH} not found — run \`npx tsx scripts/optimize-media.ts\` first.`);
  }
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

/** Minimal .env.local loader so the scripts don't need a dotenv dependency. */
export function loadEnvLocal(): void {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

/** All /posts/<dir>/... asset paths referenced by markdown content (body or
    frontmatter). Dirs are numeric legacy ids or post slugs (sureclinical,
    country-gentlemen); /images/<file> covers one-off site assets. */
export function collectReferencedPaths(postsDir = 'src/content/posts'): Set<string> {
  const paths = new Set<string>();
  for (const file of readdirSync(postsDir).filter((f: string) => f.endsWith('.md'))) {
    const content = readFileSync(join(postsDir, file), 'utf-8');
    for (const m of content.matchAll(/\/(?:posts\/[a-z0-9-]+|images)\/[^")\s<>]+\.[a-zA-Z0-9]+/g)) {
      paths.add(m[0].replace(/&amp;/g, '&'));
    }
  }
  return paths;
}

/** Lowercase and strip URL-hostile characters so R2 keys need no percent-encoding. */
export function sanitizeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = name.slice(0, dot).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/-{2,}/g, '-');
  return base + name.slice(dot).toLowerCase();
}

/** Run up to `limit` async jobs concurrently. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function fmtMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}
