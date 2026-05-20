import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const USAGE = `
Usage: npx tsx scripts/new-post.ts --title "Trip Name" --tag life --images ~/Photos/folder/

Options:
  --title    Post title (required)
  --tag      Post tag: thoughts, life, or resources (default: life)
  --images   Directory of images to include (required)
  --body     Optional markdown body file
  --excerpt  Short excerpt
  --date     Date string (default: today)
  --help     Show this help

What it does:
  1. Copies all images into public/posts/<next-number>/
  2. Generates a markdown post with all images embedded
  3. Writes to src/content/posts/<slug>.md
  4. Done — shows up in the site immediately
`;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.mov', '.heic']);

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (key === 'help') { result[key] = 'true'; }
      else { result[key] = args[++i] || ''; }
    }
  }
  return result;
}

function nextPostDir(): string {
  const postsDir = join('public', 'posts');
  if (!existsSync(postsDir)) mkdirSync(postsDir, { recursive: true });
  const existing = readdirSync(postsDir).map(Number).filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return String(next);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

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

  // Find images
  const files = readdirSync(args.images)
    .filter(f => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(`No image files found in ${args.images}`);
    process.exit(1);
  }

  // Copy images to public/posts/<n>/
  const dirNum = nextPostDir();
  const destDir = join('public', 'posts', dirNum);
  mkdirSync(destDir, { recursive: true });

  console.log(`Copying ${files.length} images to ${destDir}/...`);
  for (const file of files) {
    copyFileSync(join(args.images, file), join(destDir, file));
  }

  // Build markdown
  const slug = slugify(args.title);
  const date = args.date || new Date().toISOString().slice(0, 10);
  const featureImage = `/posts/${dirNum}/${files[0]}`;

  let body = '';
  if (args.body && existsSync(args.body)) {
    body = readFileSync(args.body, 'utf-8');
  } else {
    body = files.map(f => `![](/posts/${dirNum}/${f})`).join('\n\n');
  }

  const frontmatter = [
    '---',
    `title: "${args.title}"`,
    `date: "${date}"`,
    `tag: "${tag}"`,
    args.excerpt ? `excerpt: "${args.excerpt}"` : null,
    `feature_image: "${featureImage}"`,
    '---',
  ].filter(Boolean).join('\n');

  const markdown = `${frontmatter}\n\n${body}\n`;
  const outPath = join('src', 'content', 'posts', `${slug}.md`);

  writeFileSync(outPath, markdown, 'utf-8');

  console.log(`\n✓ Done!`);
  console.log(`  Post: ${outPath}`);
  console.log(`  Images: ${files.length} files in ${destDir}/`);
  console.log(`  Feature: ${featureImage}`);
  console.log(`\n  Run "npm run dev" and it'll show up in the gallery + post list.`);
}

main();
