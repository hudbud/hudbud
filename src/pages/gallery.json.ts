import { loadGalleryMap } from '../lib/posts';

export const prerender = true;

export async function GET() {
  const map = await loadGalleryMap();
  return new Response(JSON.stringify(map), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}
