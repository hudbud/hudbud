import { put } from '@vercel/blob';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const USAGE = `
Usage: npx tsx scripts/upload-post.ts --title "Post Title" --tag <thoughts|life|resources> --images <dir> [--body <file>]

Options:
  --title    Post title (required)
  --tag      Post tag: thoughts, life, or resources (required)
  --images   Directory containing images to upload (required)
  --body     Markdown file with post body (optional, reads from stdin if omitted)
  --excerpt  Short excerpt for the post (optional)
  --draft    Mark as draft (optional)
  --help     Show this help

Environment:
  BLOB_READ_WRITE_TOKEN  Vercel Blob token (set in .env.local)
`;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.mov']);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (key === 'help' || key === 'draft') {
        result[key] = 'true';
      } else {
        result[key] = args[++i] || '';
      }
    }
  }
  return result;
}

async function uploadImages(dir: string, slug: string): Promise<{ original: string; url: string }[]> {
  const files = readdirSync(dir).filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()));
  if (files.length === 0) {
    console.log('No image files found in', dir);
    return [];
  }

  console.log(`Uploading ${files.length} images...`);
  const results: { original: string; url: string }[] = [];

  for (const file of files) {
    const filePath = join(dir, file);
    const buffer = readFileSync(filePath);
    const blobPath = `posts/${slug}/${file}`;

    const blob = await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false,
    });

    results.push({ original: file, url: blob.url });
    console.log(`  ✓ ${file} → ${blob.url}`);
  }

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!args.title || !args.tag || !args.images) {
    console.error('Missing required arguments. Use --help for usage.');
    process.exit(1);
  }

  if (!['thoughts', 'life', 'resources'].includes(args.tag)) {
    console.error('Tag must be one of: thoughts, life, resources');
    process.exit(1);
  }

  if (!existsSync(args.images)) {
    console.error(`Images directory not found: ${args.images}`);
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set. Add it to .env.local');
    process.exit(1);
  }

  const slug = slugify(args.title);
  const uploaded = await uploadImages(args.images, slug);
  const featureImage = uploaded.length > 0 ? uploaded[0].url : undefined;

  let body = '';
  if (args.body) {
    body = readFileSync(args.body, 'utf-8');
  }

  // Replace local image references with blob URLs
  for (const { original, url } of uploaded) {
    body = body.replaceAll(`./${original}`, url);
    body = body.replaceAll(original, url);
  }

  // If no body provided, generate image markdown
  if (!body && uploaded.length > 0) {
    body = uploaded.map(({ url }) => `![](${url})`).join('\n\n');
  }

  const date = new Date().toISOString();
  const frontmatter = [
    '---',
    `title: "${args.title}"`,
    `date: "${date}"`,
    `tag: "${args.tag}"`,
    args.excerpt ? `excerpt: "${args.excerpt}"` : null,
    featureImage ? `feature_image: "${featureImage}"` : null,
    args.draft ? `draft: true` : null,
    '---',
  ].filter(Boolean).join('\n');

  const markdown = `${frontmatter}\n\n${body}\n`;
  const outPath = join('src', 'content', 'posts', `${slug}.md`);

  writeFileSync(outPath, markdown, 'utf-8');
  console.log(`\n✓ Post written to ${outPath}`);
  console.log(`  Title: ${args.title}`);
  console.log(`  Tag: ${args.tag}`);
  console.log(`  Images: ${uploaded.length}`);
  if (featureImage) console.log(`  Feature: ${featureImage}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
