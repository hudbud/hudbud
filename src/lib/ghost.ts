const ghostUrl = import.meta.env.GHOST_URL;
const ghostKey = import.meta.env.GHOST_CONTENT_API_KEY;

async function ghostFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`/ghost/api/content/${endpoint}/`, ghostUrl);
  url.searchParams.set('key', ghostKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Ghost API error: ${res.status} ${endpoint}`);
  return res.json();
}

export async function getAllPosts() {
  const data = await ghostFetch('posts', {
    limit: 'all',
    include: 'tags',
    fields: 'id,slug,title,feature_image,feature_image_alt,html,primary_tag',
  });
  return data.posts;
}

export async function getPostBySlug(slug: string) {
  const data = await ghostFetch(`posts/slug/${slug}`, {
    include: 'tags',
  });
  return data.posts?.[0] ?? null;
}

export async function getAllPages() {
  const data = await ghostFetch('pages', {
    limit: 'all',
    include: 'tags',
  });
  return data.pages;
}

export async function getPageBySlug(slug: string) {
  const data = await ghostFetch(`pages/slug/${slug}`, {
    include: 'tags',
  });
  return data.pages?.[0] ?? null;
}

export async function getTag(slug: string) {
  const data = await ghostFetch(`tags/slug/${slug}`, {
    include: 'count.posts',
  });
  return data.tags?.[0] ?? null;
}

export async function getSettings() {
  const data = await ghostFetch('settings');
  return data.settings;
}
