/**
 * Migrate Squarespace WordPress export XML into src/content/posts/*.md
 *
 * Parses pages/posts from the export, downloads images from the Squarespace CDN,
 * and generates markdown files with frontmatter.
 *
 * Usage:
 *   npx tsx scripts/migrate-squarespace.ts          # local mode (images in public/posts/<n>/)
 *   npx tsx scripts/migrate-squarespace.ts --blob   # upload to Vercel Blob
 *
 * Requirements:
 *   - cheerio (npm install cheerio)
 *   - @vercel/blob (already a devDependency, needed for --blob mode)
 *   - BLOB_READ_WRITE_TOKEN env var (for --blob mode)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const XML_PATH = path.join(ROOT, '.context/attachments/Squarespace-Wordpress-Export-05-20-2026.xml');
const OUT_DIR = path.join(ROOT, 'src/content/posts');
const PUBLIC_POSTS = path.join(ROOT, 'public/posts');

const BLOB_MODE = process.argv.includes('--blob');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageItem {
  title: string;
  slug: string;
  pubDate: string;
  imageUrls: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clean up a filename from a Squarespace CDN URL.
 * URLs can look like:
 *   .../image-asset.gif/img.gif
 *   .../image-asset.jpeg/img.jpg
 *   .../filename.png
 * We want the real filename, not the trailing /img.gif or /img.jpg suffix.
 */
function extractFilename(url: string): string {
  const urlPath = new URL(url).pathname;
  const segments = urlPath.split('/').filter(Boolean);

  // If the last segment is like "img.gif" or "img.jpg" (the Squarespace proxy suffix),
  // use the second-to-last segment as the actual filename
  const last = segments[segments.length - 1];
  if (/^img\.(gif|jpg|jpeg|png|webp)$/i.test(last) && segments.length >= 2) {
    return decodeURIComponent(segments[segments.length - 2]);
  }

  return decodeURIComponent(last);
}

/**
 * Make filenames unique by appending a counter when duplicates are found.
 */
function deduplicateFilenames(urls: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const counts = new Map<string, number>();

  for (const url of urls) {
    let filename = extractFilename(url);
    const count = counts.get(filename) || 0;
    counts.set(filename, count + 1);

    if (count > 0) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      filename = `${base}-${count}${ext}`;
    }

    result.set(url, filename);
  }

  return result;
}

/**
 * Get the next available folder number in public/posts/
 */
function getNextPostNumber(): number {
  if (!fs.existsSync(PUBLIC_POSTS)) {
    fs.mkdirSync(PUBLIC_POSTS, { recursive: true });
    return 1;
  }

  const existing = fs.readdirSync(PUBLIC_POSTS)
    .map((d) => parseInt(d, 10))
    .filter((n) => !isNaN(n));

  if (existing.length === 0) return 1;
  return Math.max(...existing) + 1;
}

/**
 * Download a file from a URL, returning the buffer or null on failure.
 */
async function downloadFile(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`    WARN: HTTP ${res.status} for ${url}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.warn(`    WARN: Failed to download ${url}: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parse XML
// ---------------------------------------------------------------------------

function parseExport(): PageItem[] {
  console.log(`Reading XML: ${XML_PATH}`);
  const xml = fs.readFileSync(XML_PATH, 'utf-8');

  // Load with cheerio in XML mode
  const $ = cheerio.load(xml, { xmlMode: true });

  const items: PageItem[] = [];

  $('item').each((_i, el) => {
    const $item = $(el);
    const postType = $item.find('wp\\:post_type').text();

    // Only process pages and posts (not attachments)
    if (postType !== 'page' && postType !== 'post') return;

    const title = $item.find('title').first().text().trim();
    const slug = $item.find('wp\\:post_name').text().trim();
    const pubDate = $item.find('pubDate').text().trim();
    const contentEncoded = $item.find('content\\:encoded').text();

    // Extract image URLs from the content HTML
    const imageUrls: string[] = [];
    if (contentEncoded) {
      const $content = cheerio.load(contentEncoded);
      $content('img').each((_j, img) => {
        const src = $content(img).attr('src');
        if (src && src.includes('squarespace-cdn.com')) {
          imageUrls.push(src);
        }
      });
    }

    // Skip pages with 0 images
    if (imageUrls.length === 0) {
      console.log(`  Skipping "${title}" (${slug}) - no images`);
      return;
    }

    items.push({ title, slug, pubDate, imageUrls });
  });

  return items;
}

// ---------------------------------------------------------------------------
// Process items - Local mode
// ---------------------------------------------------------------------------

async function processLocal(items: PageItem[]): Promise<void> {
  let folderNum = getNextPostNumber();

  for (const item of items) {
    console.log(`\n[${item.slug}] "${item.title}" (${item.imageUrls.length} images)`);

    const dir = path.join(PUBLIC_POSTS, String(folderNum));
    fs.mkdirSync(dir, { recursive: true });

    const filenameMap = deduplicateFilenames(item.imageUrls);
    const imageRefs: string[] = [];
    let featureImage: string | undefined;

    for (const url of item.imageUrls) {
      const filename = filenameMap.get(url)!;
      const localPath = `/posts/${folderNum}/${filename}`;

      console.log(`  Downloading: ${filename}`);
      const buffer = await downloadFile(url);

      if (buffer) {
        fs.writeFileSync(path.join(dir, filename), buffer);
        imageRefs.push(localPath);
        if (!featureImage) featureImage = localPath;
      }

      await sleep(100);
    }

    if (imageRefs.length === 0) {
      console.log(`  No images downloaded successfully, skipping post.`);
      // Remove the empty directory
      fs.rmdirSync(dir);
      continue;
    }

    writeMarkdown(item, imageRefs, featureImage);
    folderNum++;
  }
}

// ---------------------------------------------------------------------------
// Process items - Blob mode
// ---------------------------------------------------------------------------

async function processBlob(items: PageItem[]): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('ERROR: BLOB_READ_WRITE_TOKEN not set. Add it to .env.local');
    process.exit(1);
  }

  const { put } = await import('@vercel/blob');

  for (const item of items) {
    console.log(`\n[${item.slug}] "${item.title}" (${item.imageUrls.length} images)`);

    const filenameMap = deduplicateFilenames(item.imageUrls);
    const imageRefs: string[] = [];
    let featureImage: string | undefined;

    for (const url of item.imageUrls) {
      const filename = filenameMap.get(url)!;
      const blobPath = `posts/${item.slug}/${filename}`;

      console.log(`  Uploading: ${filename}`);
      const buffer = await downloadFile(url);

      if (buffer) {
        try {
          const blob = await put(blobPath, buffer, {
            access: 'public',
            addRandomSuffix: false,
          });
          imageRefs.push(blob.url);
          if (!featureImage) featureImage = blob.url;
          console.log(`    -> ${blob.url}`);
        } catch (err: any) {
          console.warn(`    WARN: Blob upload failed for ${filename}: ${err.message}`);
        }
      }

      await sleep(100);
    }

    if (imageRefs.length === 0) {
      console.log(`  No images uploaded successfully, skipping post.`);
      continue;
    }

    writeMarkdown(item, imageRefs, featureImage);
  }
}

// ---------------------------------------------------------------------------
// Write markdown
// ---------------------------------------------------------------------------

function writeMarkdown(item: PageItem, imageRefs: string[], featureImage?: string): void {
  const date = item.pubDate
    ? new Date(item.pubDate).toISOString()
    : new Date().toISOString();

  const frontmatter = [
    '---',
    `title: "${item.title.replace(/"/g, '\\"')}"`,
    `date: "${date}"`,
    `tag: "archive"`,
    featureImage ? `feature_image: "${featureImage}"` : null,
    '---',
  ].filter(Boolean).join('\n');

  const body = imageRefs.map((ref) => `![](${ref})`).join('\n\n');
  const markdown = `${frontmatter}\n\n${body}\n`;

  const outPath = path.join(OUT_DIR, `${item.slug}.md`);
  fs.writeFileSync(outPath, markdown, 'utf-8');
  console.log(`  -> Written: ${outPath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Squarespace -> Astro Migration');
  console.log(`Mode: ${BLOB_MODE ? 'Vercel Blob' : 'Local (public/posts/)'}`);
  console.log('');

  if (!fs.existsSync(XML_PATH)) {
    console.error(`ERROR: XML file not found at ${XML_PATH}`);
    process.exit(1);
  }

  // Ensure output dir exists
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const items = parseExport();
  console.log(`\nFound ${items.length} pages/posts with images to migrate.`);

  if (items.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (BLOB_MODE) {
    await processBlob(items);
  } else {
    await processLocal(items);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
