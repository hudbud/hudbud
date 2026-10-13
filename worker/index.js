// Worker in front of the static Astro build: serves /api/thoughts (the
// guestbook micro-feed), /thoughts.xml (its RSS feed), and the /fish high
// scores (/api/fish/scores) from D1, gates
// /lightsource behind a password, runs the /api/admin phone-posting API, and
// hands everything else to the static assets.
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

// ---------- /fish: high scores ----------
// Two boards, each one row per angler: the biggest fish, and the most fish in
// one visit. The game only posts when a catch would make the board. Checks
// keep it honest-ish; it's a toy.

const FISH_MAX = { brook: 12, rainbow: 19, cutthroat: 18, brown: 24, golden: 17 };
const FISH_FLIES = ['adams', 'bwo', 'pmd', 'caddis', 'stimi', 'hopper', 'gnat'];
const FISH_NAME = 12;
const FISH_BOARD = 10;
const FISH_RATE = 40; // catches per IP per 10 minutes; landing one takes a while

async function getFishBoards(env) {
  const fish = await env.DB.prepare(
    `SELECT name, species, fly, inches FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY inches DESC, created_at ASC) AS rn FROM fish_catches
     ) WHERE rn = 1 ORDER BY inches DESC, created_at ASC LIMIT ?`
  ).bind(FISH_BOARD).all();
  const sessions = await env.DB.prepare(
    `SELECT name, count, inches FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY count DESC, inches DESC, updated_at ASC) AS rn FROM fish_sessions
     ) WHERE rn = 1 ORDER BY count DESC, inches DESC, updated_at ASC LIMIT ?`
  ).bind(FISH_BOARD).all();
  return { fish: fish.results, sessions: sessions.results };
}

async function postFishScore(request, env) {
  const p = await request.json().catch(() => null);
  if (!p) return json({ error: 'bad json' }, 400);
  const sessionId = String(p.sessionId ?? '');
  if (!/^[a-z0-9-]{8,40}$/.test(sessionId)) return json({ error: 'bad session' }, 400);
  const { name: full } = resolveName(p.name, env.HUDBUD_SECRET);
  const name = full.slice(0, FISH_NAME);

  const f = p.fish;
  const fish = f && FISH_MAX[f.species] && FISH_FLIES.includes(f.fly) && Number.isInteger(f.inches) && f.inches > 0 && f.inches <= FISH_MAX[f.species]
    ? f
    : null;
  const s = p.session;
  const session = s && Number.isInteger(s.count) && Number.isInteger(s.inches) && s.count > 0 && s.count <= 500 && s.inches <= s.count * FISH_MAX.brown
    ? s
    : null;
  if (!fish && !session) return json({ error: 'nothing to post' }, 400);

  const hash = await ipHash(request, env.HUDBUD_SECRET);
  const now = Date.now();
  const since = now - RATE_WINDOW_MS;
  const recent = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM fish_catches WHERE ip_hash = ?1 AND created_at > ?2) AS fish,
            (SELECT COUNT(*) FROM fish_sessions WHERE ip_hash = ?1 AND created_at > ?2) AS sessions`
  ).bind(hash, since).first();
  if ((recent?.fish ?? 0) >= FISH_RATE || (recent?.sessions ?? 0) >= 10) {
    return json({ error: 'the river needs a rest' }, 429);
  }

  if (fish) {
    await env.DB.prepare(
      'INSERT INTO fish_catches (name, species, fly, inches, session_id, created_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(name, fish.species, fish.fly, fish.inches, sessionId, now, hash).run();
  }
  if (session) {
    // A visit's tally only goes up, and only from wherever it started.
    await env.DB.prepare(
      `INSERT INTO fish_sessions (id, name, count, inches, created_at, updated_at, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, count = excluded.count, inches = excluded.inches, updated_at = excluded.updated_at
       WHERE excluded.count >= fish_sessions.count AND fish_sessions.ip_hash = excluded.ip_hash`
    ).bind(sessionId, name, session.count, session.inches, now, hash).run();
  }
  return json({ name, ...(await getFishBoards(env)) }, 201);
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

// ---------- /admin: post photos from a phone ----------
// The /admin page shrinks photos in the browser, PUTs each one here to land in
// R2, then asks for a publish: the Worker commits the markdown change to
// GitHub and Workers Builds deploys it. Same casual cookie gate as
// /lightsource; the GitHub token is fine-grained to this repo's contents.
//
//   npx wrangler secret put ADMIN_PASSWORD
//   npx wrangler secret put GITHUB_TOKEN    -> fine-grained, hudbud/hudbud, Contents: read & write

const ADMIN_COOKIE = 'admin_auth';
const ADMIN_TTL_S = 90 * 24 * 60 * 60;
const MEDIA_BASE = 'https://media.hudbud.net';
const REPO = 'hudbud/hudbud';
const BRANCH = 'main';
const POST_TAGS = ['life', 'thoughts', 'resources', 'work', 'projects'];
const MEDIA_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

async function adminToken(password) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`admin:${password}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The /admin page signs in with a cookie; the iOS Shortcut sends the
    password as a bearer header instead. */
async function adminAuthed(request, password) {
  if (!password) return false;
  if (request.headers.get('Authorization') === `Bearer ${password}`) return true;
  const cookie = request.headers.get('Cookie') ?? '';
  return cookie.split(/;\s*/).includes(`${ADMIN_COOKIE}=${await adminToken(password)}`);
}

const validSlug = (s) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(s ?? '');
const slugify = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

// GitHub's contents API speaks base64; posts are UTF-8 (em dashes, emoji).
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

async function github(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'hudbud-admin',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  });
}

function sniffImage(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

/** PUT /api/admin/media?slug=&name= with the image bytes as the body. */
async function adminMedia(request, env, url) {
  const slug = url.searchParams.get('slug');
  const name = url.searchParams.get('name') ?? '';
  if (!validSlug(slug) || !/^[a-z0-9-]{1,80}$/.test(name)) return json({ error: 'bad upload' }, 400);
  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_MEDIA_BYTES) return json({ error: 'file too big' }, 413);
  // Shortcuts doesn't always label its uploads, so trust the bytes over the header.
  const type = sniffImage(new Uint8Array(body.slice(0, 12))) ?? request.headers.get('Content-Type');
  const ext = MEDIA_TYPES[type];
  if (!ext) return json({ error: 'photos only (jpeg, png, webp)' }, 415);
  const key = `posts/${slug}/${name}.${ext}`;
  await env.MEDIA.put(key, body, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return json({ url: `${MEDIA_BASE}/${key}` }, 201);
}

/** POST /api/admin/publish: append to a post, or create one. */
async function adminPublish(request, env) {
  const p = await request.json().catch(() => null);
  if (!p) return json({ error: 'bad json' }, 400);
  // An array from the page; newline-joined text from the Shortcut.
  const list = Array.isArray(p.images) ? p.images : String(p.images ?? '').split(/\s+/);
  const images = list.filter((u) => typeof u === 'string' && u.startsWith(`${MEDIA_BASE}/posts/`));
  const text = String(p.text ?? '').trim();
  const block = [text, ...images.map((u) => `![](${u})`)].filter(Boolean).join('\n\n');
  if (!block) return json({ error: 'nothing to add' }, 400);

  if (p.mode === 'new') {
    const title = String(p.title ?? '').trim().slice(0, 140);
    const slug = slugify(title);
    if (!title || !validSlug(slug)) return json({ error: 'needs a title' }, 400);
    const tag = POST_TAGS.includes(p.tag) ? p.tag : 'life';
    const path = `src/content/posts/${slug}.md`;
    const existing = await github(env, `${path}?ref=${BRANCH}`);
    if (existing.ok) return json({ error: `a post called "${slug}" already exists` }, 409);
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(title)}`,
      `date: ${JSON.stringify(String(p.date || new Date().toISOString().slice(0, 10)))}`,
      `tags: ["${tag}"]`,
      images[0] ? `feature_image: "${images[0]}"` : null,
      p.draft ? 'draft: true' : null,
      '---',
    ].filter(Boolean).join('\n');
    const res = await github(env, path, {
      method: 'PUT',
      body: JSON.stringify({ message: `New post from my phone: ${title}`, content: toBase64(`${frontmatter}\n\n${block}\n`), branch: BRANCH }),
    });
    if (!res.ok) return json({ error: `github said ${res.status}` }, 502);
    return json({ slug, path: `/posts/${slug}` }, 201);
  }

  const slug = p.slug;
  if (!validSlug(slug)) return json({ error: 'pick a post' }, 400);
  const path = `src/content/posts/${slug}.md`;
  const current = await github(env, `${path}?ref=${BRANCH}`);
  if (!current.ok) return json({ error: current.status === 404 ? 'post not found' : `github said ${current.status}` }, 502);
  const { content, sha } = await current.json();
  const next = `${fromBase64(content).trimEnd()}\n\n${block}\n`;
  const count = images.length;
  const res = await github(env, path, {
    method: 'PUT',
    body: JSON.stringify({
      message: count ? `Add ${count} photo${count === 1 ? '' : 's'} to ${slug} from my phone` : `Add a note to ${slug} from my phone`,
      content: toBase64(next),
      sha,
      branch: BRANCH,
    }),
  });
  // 409: the file changed between read and write (a laptop push). Try again.
  if (!res.ok) return json({ error: res.status === 409 ? 'post just changed, try again' : `github said ${res.status}` }, 502);
  return json({ slug, path: `/posts/${slug}` });
}

async function admin(request, env, url) {
  const route = url.pathname.slice('/api/admin/'.length);

  if (route === 'login' && request.method === 'POST') {
    const p = await request.json().catch(() => null);
    if (!env.ADMIN_PASSWORD || p?.password !== env.ADMIN_PASSWORD) return json({ error: 'not quite' }, 401);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${ADMIN_COOKIE}=${await adminToken(env.ADMIN_PASSWORD)}; Path=/api/admin; Max-Age=${ADMIN_TTL_S}; HttpOnly; Secure; SameSite=Strict`,
      },
    });
  }

  if (!(await adminAuthed(request, env.ADMIN_PASSWORD))) return json({ error: 'locked' }, 401);
  if (route === 'session') return json({ ok: true });
  if (route === 'media' && request.method === 'PUT') return adminMedia(request, env, url);
  if (route === 'publish' && request.method === 'POST') return adminPublish(request, env);
  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/lightsource' || url.pathname.startsWith('/lightsource/')) {
      return lightsource(request, env, url);
    }

    if (url.pathname.startsWith('/api/admin/')) {
      try {
        return await admin(request, env, url);
      } catch {
        return json({ error: 'something broke' }, 500);
      }
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

    if (url.pathname === '/api/fish/scores') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      try {
        if (request.method === 'GET') return json(await getFishBoards(env));
        if (request.method === 'POST') return await postFishScore(request, env);
      } catch {
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
