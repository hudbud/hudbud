/**
 * One-shot migration from the old Publii site (.context/hudbud-old) into
 * src/content/posts/*.md, copying full-resolution images into public/posts/.
 *
 * Usage:
 *   npx tsx scripts/migrate-old-site.ts
 *
 * Idempotent: re-running overwrites markdown and re-copies images.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OLD = path.join(ROOT, '.context/hudbud-old/hudbud.net');
const FILES = path.join(ROOT, '.context/hudbud-old/files');
const OUT = path.join(ROOT, 'src/content/posts');
const PUBLIC_POSTS = path.join(ROOT, 'public/posts');

type Tag = 'thoughts' | 'life' | 'resources';

// Final mapping per Hudson's triage. All 20 articles, none dropped.
const TAGS: Record<string, Tag> = {
  '08082024': 'life',
  'bike-ride-0392025': 'life',
  'carvanads': 'thoughts',
  'cool-1883-map-of-california': 'life',
  'design-resources-list': 'resources',
  'distorted-reality': 'thoughts',
  'east-fork-carson-river-fly-fishing': 'life',
  'fort-funston': 'life',
  'granking': 'life',
  'la-chris-wedding': 'life',
  'laos-bag-report': 'thoughts',
  'mendo': 'life',
  'outdoors-resources-list': 'resources',
  'santa-fe': 'life',
  'sonora-pass': 'life',
  'trinity-alps': 'life',
  'tulum-or-the-yucatan': 'life',
  'vitarave': 'life',
  'web-builders': 'thoughts',
  'wild-rainbows': 'life',
};

const HOST = 'https://hudbud.net';
const MEDIA_RE = /https?:\/\/hudbud\.net\/media\/posts\/(\d+)\/([^"'\s)>]+)/g;

interface FeedItem {
  url: string;
  title: string;
  summary?: string;
  content_html: string;
  date_published: string;
  date_modified?: string;
}

function loadFeed(): Map<string, FeedItem> {
  const raw = JSON.parse(fs.readFileSync(path.join(OLD, 'feed.json'), 'utf-8'));
  const m = new Map<string, FeedItem>();
  for (const it of raw.items) m.set(it.url, it as FeedItem);
  return m;
}

interface ParsedPost {
  slug: string;
  title: string;
  date: string;
  bodyHtml: string;
  feature_image?: string;
  excerpt?: string;
}

function parseHtmlFile(slug: string, htmlPath: string, feed: Map<string, FeedItem>): ParsedPost {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  const title = $('article.content h1').first().text().trim() || slug;

  let date = '';
  const ld = $('script[type="application/ld+json"]').first().text();
  if (ld) {
    try {
      const j = JSON.parse(ld);
      if (j.datePublished) date = j.datePublished;
    } catch {}
  }
  if (!date) {
    const t = $('time[datetime]').first().attr('datetime');
    if (t) date = t;
  }
  date = date || new Date().toISOString();

  let feature_image = $('meta[property="og:image"]').attr('content') || undefined;

  const feedItem = feed.get(`${HOST}/${slug}.html`);
  let bodyHtml: string;
  let excerpt: string | undefined;
  if (feedItem) {
    bodyHtml = feedItem.content_html;
    excerpt = feedItem.summary?.trim() || undefined;
  } else {
    const $body = $('div.entry-wrapper.content__entry').first();
    if (!$body.length) {
      console.warn(`[${slug}] no entry-wrapper found, using empty body`);
      bodyHtml = '';
    } else {
      bodyHtml = $body.html() || '';
    }
  }

  // Fallback: if no og:image, use the first body image
  if (!feature_image) {
    const firstImg = bodyHtml.match(MEDIA_RE);
    if (firstImg && firstImg[0]) feature_image = firstImg[0];
  }

  return { slug, title, date, bodyHtml, feature_image, excerpt };
}

function normalizeBody(bodyHtml: string): string {
  const $ = cheerio.load(`<div id="root">${bodyHtml}</div>`, null, false);

  $('img').each((_i, el) => {
    $(el).removeAttr('srcset');
    $(el).removeAttr('sizes');
    $(el).removeAttr('loading');
    $(el).removeAttr('width');
    $(el).removeAttr('height');
  });

  // Unwrap Publii lightbox anchors (self-link to image, before or after rewrite)
  $('a').each((_i, el) => {
    const href = $(el).attr('href') || '';
    if (/^(https?:\/\/hudbud\.net\/media\/posts\/|\/posts\/)/.test(href)) {
      const $img = $(el).find('img').first();
      if ($img.length) $(el).replaceWith($img);
    }
  });

  $('p').each((_i, el) => {
    if (!$(el).text().trim() && !$(el).find('img,iframe,a').length) $(el).remove();
  });

  return $('#root').html() || '';
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  bulletListMarker: '-',
});

turndown.addRule('iframe', {
  filter: 'iframe',
  replacement: (_content, node) => {
    const el = node as unknown as { outerHTML: string };
    return `\n\n${el.outerHTML}\n\n`;
  },
});

turndown.addRule('figure', {
  filter: 'figure',
  replacement: (content) => content.trim() + '\n',
});

/** Copy an original image from .context to public/posts/<id>/<filename>.
 *  Returns the public URL or null if missing. */
function copyImage(postId: string, filename: string, copied: Set<string>): string | null {
  const key = `${postId}/${filename}`;
  const dest = path.join(PUBLIC_POSTS, postId, filename);
  if (copied.has(key)) return `/posts/${postId}/${filename}`;
  const src = path.join(FILES, 'media', 'posts', postId, filename);
  if (!fs.existsSync(src)) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied.add(key);
  return `/posts/${postId}/${filename}`;
}

/** Resolve any old-site image URL to a canonical filename + new public URL.
 *  Handles responsive/ variants and -thumbnail suffixes by mapping back to
 *  the original at /posts/<id>/<filename>. */
function resolveImage(postId: string, rest: string, copied: Set<string>): string | null {
  let filename = rest;
  if (filename.startsWith('responsive/')) {
    filename = filename.slice('responsive/'.length);
    filename = filename.replace(/-(xs|sm|md|lg|xl|2xl)\.([a-z]+)$/i, '.$2');
  }
  filename = filename.replace(/-thumbnail\.([a-z]+)$/i, '.$1');
  const url = copyImage(postId, filename, copied);
  if (url) return url;
  // Fallback: try the literal file (some posts use the responsive image directly)
  return copyImage(postId, rest.startsWith('responsive/') ? rest.slice('responsive/'.length) : rest, copied);
}

function rewriteUrls(text: string, copied: Set<string>): string {
  return text.replace(MEDIA_RE, (full, postId, rest) => {
    const url = resolveImage(postId, rest, copied);
    if (!url) {
      console.warn(`  ! no local file for ${full}`);
      return full;
    }
    return url;
  });
}

function frontmatter(d: Record<string, string | number | boolean | undefined>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === '') continue;
    if (typeof v === 'string') {
      const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      lines.push(`${k}: "${escaped}"`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PUBLIC_POSTS, { recursive: true });
  const feed = loadFeed();
  const copied = new Set<string>();

  for (const [slug, tag] of Object.entries(TAGS)) {
    const htmlPath = path.join(OLD, `${slug}.html`);
    if (!fs.existsSync(htmlPath)) {
      console.warn(`Skipping ${slug} — no html file`);
      continue;
    }
    const post = parseHtmlFile(slug, htmlPath, feed);

    let body = rewriteUrls(post.bodyHtml, copied);
    // Drop any image whose src didn't resolve to a local file
    const $b = cheerio.load(`<div id="root">${body}</div>`, null, false);
    $b('img').each((_i, el) => {
      const src = $b(el).attr('src') || '';
      if (!src.startsWith('/')) $b(el).remove();
    });
    body = $b('#root').html() || '';
    body = normalizeBody(body);
    const md = turndown.turndown(body);

    let feature_image = post.feature_image
      ? rewriteUrls(post.feature_image, copied)
      : undefined;
    // Only keep feature_image if it resolved to a local file
    if (feature_image && !feature_image.startsWith('/')) feature_image = undefined;

    const fm = frontmatter({
      title: post.title,
      date: post.date,
      tag,
      excerpt: post.excerpt,
      feature_image,
    });

    const outPath = path.join(OUT, `${slug}.md`);
    fs.writeFileSync(outPath, fm + md.trim() + '\n');
    console.log(`→ ${slug} (${tag})  images=${countImagesInPost(slug, copied)}`);
  }
  console.log(`\ndone. ${copied.size} unique image files copied into public/posts/`);
}

function countImagesInPost(slug: string, copied: Set<string>): number {
  // Approximation: count entries by last-touched (Set order isn't reliable)
  // Just return total seen so far for the running tally.
  return copied.size;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
