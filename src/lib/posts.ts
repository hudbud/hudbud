import { getCollection, render, type CollectionEntry } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { Post } from '../data/posts';

type Tag = 'thoughts' | 'life' | 'resources' | 'archive' | 'work';

let cachedContainer: Promise<AstroContainer> | null = null;
function getContainer() {
  if (!cachedContainer) cachedContainer = AstroContainer.create();
  return cachedContainer;
}

function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}.${d.getFullYear()}`;
}

async function entryToPost(entry: CollectionEntry<'posts'>): Promise<Post> {
  const { Content } = await render(entry);
  const container = await getContainer();
  const html = await container.renderToString(Content);
  return {
    title: entry.data.title,
    date: formatDate(entry.data.date),
    excerpt: entry.data.excerpt ?? '',
    html,
    slug: entry.id,
    feature_image: entry.data.feature_image,
    roles: entry.data.roles,
    tools: entry.data.tools,
    agency: entry.data.agency,
  };
}

export async function loadPosts(tag: Tag): Promise<Post[]> {
  const entries = await getCollection('posts', (e) => e.data.tag === tag && !e.data.draft);
  entries.sort((a, b) => +b.data.date - +a.data.date);
  return Promise.all(entries.map(entryToPost));
}

export interface GalleryImage {
  src: string;
  slug: string;
}

export async function loadAllImages(): Promise<GalleryImage[]> {
  const entries = await getCollection('posts', (e) => !e.data.draft);
  const images: GalleryImage[] = [];
  const seen = new Set<string>();
  const imgRegex = /!\[.*?\]\(([^)]+)\)/g;

  for (const entry of entries) {
    if (entry.data.feature_image && !seen.has(entry.data.feature_image)) {
      seen.add(entry.data.feature_image);
      images.push({ src: entry.data.feature_image, slug: entry.id });
    }
    let match;
    while ((match = imgRegex.exec(entry.body)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        images.push({ src: match[1], slug: entry.id });
      }
    }
    imgRegex.lastIndex = 0;
  }

  for (let i = images.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [images[i], images[j]] = [images[j], images[i]];
  }

  return images;
}

export interface GraphPost {
  slug: string;
  title: string;
  tag: string;
  featureImage?: string;
  images: string[];
}

export async function loadGraphData(): Promise<GraphPost[]> {
  const entries = await getCollection('posts', (e) => !e.data.draft);
  const imgRegex = /!\[.*?\]\(([^)]+)\)/g;

  return entries.map((entry) => {
    const images: string[] = [];
    if (entry.data.feature_image) images.push(entry.data.feature_image);
    let match;
    while ((match = imgRegex.exec(entry.body)) !== null) {
      if (!images.includes(match[1])) images.push(match[1]);
    }
    imgRegex.lastIndex = 0;
    return {
      slug: entry.id,
      title: entry.data.title,
      tag: entry.data.tag,
      featureImage: entry.data.feature_image,
      images,
    };
  });
}
