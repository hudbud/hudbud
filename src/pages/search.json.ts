import { loadSearchIndex, type SearchItem } from '../lib/posts';
import { IDEAS } from '../data/ideas';
import { RESUME } from '../data/resume';

export const prerender = true;

export async function GET() {
  const posts = await loadSearchIndex();
  const hrefs = new Set(posts.map((p) => p.href));

  // Ideas without a post of their own (unlinked ones still show, going nowhere
  // is worse than landing on the homepage list).
  const ideas: SearchItem[] = IDEAS
    .filter((i) => !hrefs.has(i.href))
    .map((i) => ({
      kind: i.section === 'work' ? 'work' : 'project',
      title: i.title,
      sub: i.statusNote ?? i.desc,
      href: i.href && i.href !== '#' ? i.href : '/',
      external: !!i.href && i.href !== '#' && !i.internal,
      year: i.date.slice(0, 4),
      text: [i.title, i.desc, i.status, i.statusNote].filter(Boolean).join(' ').toLowerCase(),
    }));

  // Resume lines land on /about, where the experience table lives.
  const resume = RESUME.map((r) => ({
    title: `${r.role} · ${r.org}`,
    sub: r.years,
    href: '/about',
    text: `${r.role} ${r.org} ${r.years} resume experience`.toLowerCase(),
  }));

  return new Response(JSON.stringify({ items: [...posts, ...ideas], resume }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}
