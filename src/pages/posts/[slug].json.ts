import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { renderPostHtml } from '../../lib/posts';

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection('posts', (e) => !e.data.draft);
  return posts.map((p) => ({ params: { slug: p.id }, props: { entry: p } }));
}

export const GET: APIRoute<{ entry: CollectionEntry<'posts'> }> = async ({ props }) => {
  const html = await renderPostHtml(props.entry);
  return new Response(JSON.stringify({ html }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
