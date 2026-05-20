import { put } from '@vercel/blob';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';

const POSTS_DIR = 'src/content/posts';
const PUBLIC_POSTS = 'public/posts';
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.mov']);

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (IMAGE_EXTS.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set. Add it to .env.local');
    process.exit(1);
  }

  if (!existsSync(PUBLIC_POSTS)) {
    console.error(`${PUBLIC_POSTS} directory not found. Nothing to migrate.`);
    process.exit(1);
  }

  // Collect all images from public/posts/
  const allImages = collectFiles(PUBLIC_POSTS);
  console.log(`Found ${allImages.length} images to upload.`);

  // Upload each image and build a URL map
  const urlMap = new Map<string, string>();
  let uploaded = 0;

  for (const filePath of allImages) {
    const relPath = '/' + relative('public', filePath);
    const buffer = readFileSync(filePath);
    const blobPath = relative('public', filePath);

    try {
      const blob = await put(blobPath, buffer, {
        access: 'public',
        addRandomSuffix: false,
      });
      urlMap.set(relPath, blob.url);
      uploaded++;
      if (uploaded % 10 === 0) console.log(`  Uploaded ${uploaded}/${allImages.length}...`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${relPath} — ${err.message}`);
    }
  }

  console.log(`\nUploaded ${uploaded} images. Rewriting markdown files...`);

  // Rewrite markdown files
  if (!existsSync(POSTS_DIR)) {
    console.log(`${POSTS_DIR} not found — skipping markdown rewrite.`);
    return;
  }

  const mdFiles = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  let rewritten = 0;

  for (const file of mdFiles) {
    const filePath = join(POSTS_DIR, file);
    let content = readFileSync(filePath, 'utf-8');
    let changed = false;

    for (const [localPath, blobUrl] of urlMap) {
      if (content.includes(localPath)) {
        content = content.replaceAll(localPath, blobUrl);
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(filePath, content, 'utf-8');
      rewritten++;
    }
  }

  console.log(`Rewrote ${rewritten} markdown files.`);
  console.log(`\nDone! You can now safely remove ${PUBLIC_POSTS}/ from the repo.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
