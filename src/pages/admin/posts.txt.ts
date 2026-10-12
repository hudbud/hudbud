import { loadAdminPosts } from '../../lib/posts';

export const prerender = true;

/** Post slugs, one per line, newest first: the iOS Shortcut's post picker. */
export async function GET() {
  const posts = await loadAdminPosts();
  return new Response(posts.map((p) => p.slug).join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
