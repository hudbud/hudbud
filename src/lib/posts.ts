import { getCollection, render, type CollectionEntry } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { Post } from '../data/posts';

type Tag = 'thoughts' | 'life' | 'resources';

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
  };
}

export async function loadPosts(tag: Tag): Promise<Post[]> {
  const entries = await getCollection('posts', (e) => e.data.tag === tag && !e.data.draft);
  entries.sort((a, b) => +b.data.date - +a.data.date);
  return Promise.all(entries.map(entryToPost));
}
