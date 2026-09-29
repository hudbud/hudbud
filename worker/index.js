// Worker in front of the static Astro build: serves /api/thoughts (the
// guestbook micro-feed) and /thoughts.xml (its RSS feed) from D1, gates
// /lightsource behind a password, and hands everything else to the static
// assets.
//
// One-time setup:
//   npx wrangler d1 create hudbud-thoughts        -> paste database_id into wrangler.jsonc
//   npx wrangler d1 execute hudbud-thoughts --remote --file worker/schema.sql
//   npx wrangler secret put HUDBUD_SECRET         -> the codeword that posts as "hudbud"

const PAGE_SIZE = 50;
const MAX_BODY = 500;
const MAX_NAME = 40;
const RATE_LIMIT = 5; // posts per IP per 10 minutes
const RATE_WINDOW_MS = 10 * 60 * 1000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/** The posting rules: the secret codeword becomes "hudbud" (verified); anyone
    else trying to pass as hudbud/hudson gets renamed to "guest". */
function resolveName(raw, secret) {
  const name = (raw ?? '').trim().slice(0, MAX_NAME);
  if (secret && name === secret) return { name: 'hudbud', isHudbud: true };
  const squashed = name.replace(/[\s.\-_]/g, '').toLowerCase();
  if (!name || squashed === 'hudbud' || squashed === 'hudson') return { name: 'guest', isHudbud: false };
  return { name, isHudbud: false };
}

async function ipHash(request, secret) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const data = new TextEncoder().encode(`${secret ?? 'hp-salt'}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function rowToThought(row) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    isHudbud: !!row.is_hudbud,
    createdAt: row.created_at,
  };
}

async function getThoughts(env, url) {
  const before = Number(url.searchParams.get('before')) || 0;
  const stmt = before
    ? env.DB.prepare('SELECT * FROM thoughts WHERE id < ? ORDER BY id DESC LIMIT ?').bind(before, PAGE_SIZE)
    : env.DB.prepare('SELECT * FROM thoughts ORDER BY id DESC LIMIT ?').bind(PAGE_SIZE);
  const { results } = await stmt.all();
  return json({
    thoughts: results.map(rowToThought),
    hasMore: results.length === PAGE_SIZE,
  });
}

async function postThought(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const body = (payload.body ?? '').trim().slice(0, MAX_BODY);
  if (!body) return json({ error: 'say something first' }, 400);

  const hash = await ipHash(request, env.HUDBUD_SECRET);
  const since = Date.now() - RATE_WINDOW_MS;
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM thoughts WHERE ip_hash = ? AND created_at > ?'
  ).bind(hash, since).first();
  if ((recent?.n ?? 0) >= RATE_LIMIT) {
    return json({ error: 'slow down a little — try again in a few minutes' }, 429);
  }

  const { name, isHudbud } = resolveName(payload.name, env.HUDBUD_SECRET);
  const createdAt = Date.now();
  const { meta } = await env.DB.prepare(
    'INSERT INTO thoughts (name, body, is_hudbud, created_at, ip_hash) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, body, isHudbud ? 1 : 0, createdAt, hash).run();

  return json({
    thought: { id: meta.last_row_id, name, body, isHudbud, createdAt },
  }, 201);
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

async function rss(env, origin) {
  const { results } = await env.DB.prepare('SELECT * FROM thoughts ORDER BY id DESC LIMIT 50').all();
  const items = results.map((row) => {
    const t = rowToThought(row);
    const title = t.body.length > 80 ? `${t.body.slice(0, 77)}...` : t.body;
    return `    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(t.body)}</description>
      <author>${escapeXml(t.name)}</author>
      <pubDate>${new Date(t.createdAt).toUTCString()}</pubDate>
      <guid isPermaLink="false">hudbud-thought-${t.id}</guid>
      <link>${origin}/?thoughts=open</link>
    </item>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>hudbud thoughts</title>
    <link>${origin}</link>
    <description>little thoughts from hudbud.net — mine and guests'</description>
${items}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

// ---------- /lightsource: password-gated case study ----------
// A simple password wall, not real security: the pages are ordinary static
// assets and the images are public on media.hudbud.net. The cookie is a hash
// of the password, so changing it signs everyone out.
//
//   npx wrangler secret put LIGHTSOURCE_PASSWORD

const LS_COOKIE = 'ls_auth';
const LS_TTL_S = 30 * 24 * 60 * 60;

async function lsToken(password) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lightsource:${password}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function lsAuthed(request, password) {
  if (!password) return false;
  const cookie = request.headers.get('Cookie') ?? '';
  return cookie.split(/;\s*/).includes(`${LS_COOKIE}=${await lsToken(password)}`);
}

/** Where to land after unlocking: only ever a /lightsource page. */
function lsNext(raw) {
  const next = String(raw ?? '');
  return /^\/lightsource(\/[a-z-]*)?\/?$/.test(next) ? next : '/lightsource';
}

async function lightsource(request, env, url) {
  const password = env.LIGHTSOURCE_PASSWORD;
  const sub = url.pathname.slice('/lightsource'.length).replace(/^\/|\/$/g, '');

  if (sub === 'unlock' && request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const next = lsNext(form?.get('next'));
    if (!password || form?.get('password') !== password) {
      return Response.redirect(`${url.origin}/lightsource/unlock?next=${encodeURIComponent(next)}&error=wrong`, 303);
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: next,
        'Set-Cookie': `${LS_COOKIE}=${await lsToken(password)}; Path=/lightsource; Max-Age=${LS_TTL_S}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  if (sub === 'lock') {
    return new Response(null, {
      status: 303,
      headers: { Location: '/', 'Set-Cookie': `${LS_COOKIE}=; Path=/lightsource; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (sub !== 'unlock' && !(await lsAuthed(request, password))) {
    return Response.redirect(`${url.origin}/lightsource/unlock?next=${encodeURIComponent(url.pathname)}`, 302);
  }

  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/lightsource' || url.pathname.startsWith('/lightsource/')) {
      return lightsource(request, env, url);
    }

    if (url.pathname === '/api/thoughts') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      try {
        if (request.method === 'GET') return await getThoughts(env, url);
        if (request.method === 'POST') return await postThought(request, env);
      } catch (e) {
        return json({ error: 'something broke' }, 500);
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (url.pathname === '/thoughts.xml') {
      try {
        return await rss(env, url.origin);
      } catch {
        return new Response('rss unavailable', { status: 503 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
