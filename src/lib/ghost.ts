import type { Post } from '../data/posts';

const ghostUrl = import.meta.env.GHOST_URL;
const ghostKey = import.meta.env.GHOST_CONTENT_API_KEY;

interface GhostPost {
  id: string;
  slug: string;
  title: string;
  feature_image: string | null;
  html: string | null;
  custom_excerpt: string | null;
  excerpt: string | null;
  published_at: string | null;
}

async function ghostFetch(endpoint: string, params: Record<string, string> = {}) {
  if (!ghostUrl || !ghostKey) return null;
  const url = new URL(`/ghost/api/content/${endpoint}/`, ghostUrl);
  url.searchParams.set('key', ghostKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}.${d.getFullYear()}`;
}

export async function fetchByTag(slug: string): Promise<Post[]> {
  const data = await ghostFetch('posts', {
    filter: `tag:${slug}`,
    limit: 'all',
    fields: 'id,slug,title,feature_image,html,custom_excerpt,excerpt,published_at',
  });
  if (!data?.posts) return [];
  return (data.posts as GhostPost[]).map((p) => ({
    title: p.title,
    date: formatDate(p.published_at),
    excerpt: p.custom_excerpt || p.excerpt || '',
    html: p.html || undefined,
    slug: p.slug,
    feature_image: p.feature_image || undefined,
  }));
}
