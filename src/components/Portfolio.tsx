import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BIO_INTRO, BIO_BODY, BIO_BODY_2, BIO_BODY_3, BIO_BODY_4, BIO_ORIGIN, MODAL_CONTENT } from '../data/bio';
import { RESUME, LINKS, SELECT_CLIENTS } from '../data/resume';
import { IDEAS, type IdeaStatus } from '../data/ideas';
import { TILES, type Tile } from '../data/tiles';
import { MT_THEMES, THEME_PAIRS } from '../data/themes';
import { type Post } from '../data/posts';
import { KEYBOARD_HTML } from '../data/keyboard';
import FreezerMartini from './FreezerMartini';
import { Lock, LockOpen, Shuffle, Moon, Sun } from '@phosphor-icons/react';

type TabId = 'ideas' | 'life' | 'thoughts' | 'work';
type FontId = 'mono' | 'serif' | 'sans' | 'dys' | 'apfel';

const TAGS: TabId[] = ['ideas', 'life', 'thoughts', 'work'];

const FONT_IDS: FontId[] = ['mono', 'serif', 'sans', 'dys', 'apfel'];

const DEFAULTS = {
  theme: 'bushido',
  density: '3x5',
  font: 'mono' as FontId,
};

function getInitialTheme(): string {
  if (typeof window === 'undefined') return DEFAULTS.theme;
  const locked = localStorage.getItem('hp-lock-theme');
  if (locked) return localStorage.getItem('hp-theme') || DEFAULTS.theme;
  return MT_THEMES[Math.floor(Math.random() * MT_THEMES.length)].name;
}

function getInitialFont(): FontId {
  if (typeof window === 'undefined') return DEFAULTS.font;
  const locked = localStorage.getItem('hp-lock-font');
  if (locked) return (localStorage.getItem('hp-font') as FontId) || DEFAULTS.font;
  return FONT_IDS[Math.floor(Math.random() * FONT_IDS.length)];
}

// ---------- LifeImage ----------
function LifeImage({ color, seed = 0, height = 140 }: { color: string; seed?: number; height?: number }) {
  const patterns = [
    `repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 9px, transparent 9px 18px)`,
    `radial-gradient(circle at ${30 + (seed * 7) % 40}% ${40 + (seed * 11) % 30}%, rgba(255,255,255,0.08), transparent 60%)`,
    `linear-gradient(to bottom, rgba(255,255,255,0.06), transparent 60%)`,
  ];
  const pat = patterns[seed % 3];
  return (
    <div style={{ width: '100%', height, background: color, position: 'relative', overflow: 'hidden', borderRadius: 2 }}>
      <div style={{ position: 'absolute', inset: 0, background: pat }} />
      <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>fig.</div>
    </div>
  );
}

// ---------- Tile pattern ----------
function TilePattern({ tile }: { tile: Tile }) {
  const baseStyle: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const { kind } = tile;

  if (kind === 'photo-series') {
    return <div style={{ ...baseStyle, background: `repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 8px, transparent 8px 16px)` }} />;
  }
  if (kind === 'writing') {
    return (
      <div style={{ ...baseStyle, flexDirection: 'column', padding: 14, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ height: 2, background: 'rgba(255,255,255,0.18)', width: `${60 + (i * 7) % 35}%`, marginBottom: 5 }} />
        ))}
      </div>
    );
  }
  if (kind === 'motion' || kind === 'animation') {
    return (
      <div style={baseStyle}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.25)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 12, height: 12, background: 'rgba(255,255,255,0.3)', transform: 'translate(-50%, -50%)' }} />
        </div>
      </div>
    );
  }
  if (kind === 'software' || kind === 'product' || kind === 'design-system' || kind === 'web') {
    return (
      <div style={{ ...baseStyle, padding: 12, alignItems: 'flex-start', flexDirection: 'column' }}>
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.12)', marginBottom: 4 }} />
        <div style={{ width: '70%', height: 6, background: 'rgba(255,255,255,0.18)', marginBottom: 4 }} />
        <div style={{ width: '40%', height: 6, background: 'rgba(255,255,255,0.12)' }} />
      </div>
    );
  }
  if (kind === 'identity' || kind === 'brand') {
    return (
      <div style={baseStyle}>
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
          {tile.title.charAt(0)}
        </div>
      </div>
    );
  }
  if (kind === 'print' || kind === 'ar') {
    return (
      <div style={baseStyle}>
        <div style={{ width: '55%', height: '70%', background: 'rgba(255,255,255,0.08)', borderRadius: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    );
  }
  return null;
}

function TileMedia({ tile, fill = true }: { tile: Tile; fill?: boolean }) {
  if (tile.image) {
    return (
      <img
        src={tile.image}
        alt={tile.title}
        style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } : { width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  return <TilePattern tile={tile} />;
}

// ---------- Chrome (theme switcher) ----------
function dot(bg: string): CSSProperties {
  return { width: 8, height: 8, borderRadius: '50%', background: bg, display: 'inline-block' };
}

function ThemeChrome({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const cur = MT_THEMES.find((t) => t.name === theme) || MT_THEMES[0];

  useEffect(() => {
    if (open) { setSearch(''); setTimeout(() => searchRef.current?.focus(), 0); }
  }, [open]);

  const filtered = search
    ? MT_THEMES.filter((t) => t.name.replace(/_/g, ' ').includes(search.toLowerCase()))
    : MT_THEMES;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px', color: 'var(--fg-dim)', fontSize: 11 }}
      >
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <span style={dot(cur.bg)} />
          <span style={dot(cur.fg)} />
          <span style={dot(cur.accent)} />
        </span>
        <span style={{ letterSpacing: '0.02em' }}>{cur.name.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▴</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: 4, minWidth: 220, zIndex: 50, boxShadow: '0 -8px 24px rgba(0,0,0,0.4)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search themes..."
            style={{ background: 'var(--tile)', border: '1px solid var(--rule)', borderRadius: 3, padding: '6px 10px', fontSize: 11, color: 'var(--fg)', outline: 'none', marginBottom: 4 }}
          />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.map((t) => (
              <button
                key={t.name}
                onClick={() => { setTheme(t.name); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 2, background: t.name === theme ? 'var(--tile)' : 'transparent', color: t.name === theme ? 'var(--fg)' : 'var(--fg-dim)', fontSize: 11 }}
                onMouseEnter={(e) => { if (t.name !== theme) e.currentTarget.style.color = 'var(--fg)'; }}
                onMouseLeave={(e) => { if (t.name !== theme) e.currentTarget.style.color = 'var(--fg-dim)'; }}
              >
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={dot(t.bg)} />
                  <span style={dot(t.fg)} />
                  <span style={dot(t.accent)} />
                </span>
                {t.name.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Font switcher ----------
const FONT_FAMILY: Record<FontId, string> = {
  mono: "'Geist Mono', ui-monospace, Menlo, monospace",
  serif: "'Newsreader', Georgia, serif",
  sans: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  dys: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
  apfel: "'Apfel Grotezk', -apple-system, BlinkMacSystemFont, sans-serif",
};

function FontSwitcher({ font, setFont }: { font: FontId; setFont: (f: FontId) => void }) {
  const [open, setOpen] = useState(false);
  const OPTS: { id: FontId; label: string; hint: string }[] = [
    { id: 'mono', label: 'mono', hint: 'Geist Mono' },
    { id: 'serif', label: 'serif', hint: 'Newsreader' },
    { id: 'sans', label: 'sans', hint: 'DM Sans' },
    { id: 'apfel', label: 'apfel grotezk', hint: 'custom' },
    { id: 'dys', label: 'opendyslexic', hint: 'accessibility' },
  ];
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="font"
        style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-dim)', fontSize: 14, fontWeight: 600 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
      >
        <span style={{ fontFamily: FONT_FAMILY[font] }}>Aa</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: 4, minWidth: 220, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {OPTS.map((o) => (
            <button
              key={o.id}
              onClick={() => { setFont(o.id); setOpen(false); }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 2, background: o.id === font ? 'var(--tile)' : 'transparent', color: o.id === font ? 'var(--fg)' : 'var(--fg-dim)', fontSize: 11 }}
              onMouseEnter={(e) => { if (o.id !== font) e.currentTarget.style.color = 'var(--fg)'; }}
              onMouseLeave={(e) => { if (o.id !== font) e.currentTarget.style.color = 'var(--fg-dim)'; }}
            >
              <span style={{ fontFamily: FONT_FAMILY[o.id] }}>{o.label}</span>
              <span style={{ color: 'var(--fg-faint)', fontSize: 10 }}>{o.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SITE_VERSIONS = [
  { label: '2026 (current)', url: '' },
  { label: '2024', url: 'https://2024.paine.design' },
  { label: '2022', url: 'https://2022.paine.design' },
];

function TimeTravelSelector({ onSelect }: { onSelect: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 11, color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', gap: 4 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
      >
        <span>time machine</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>▴</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: 4, minWidth: 160, zIndex: 50, boxShadow: '0 -8px 24px rgba(0,0,0,0.4)' }}>
          {SITE_VERSIONS.map((v) => (
            <button
              key={v.label}
              onClick={() => { if (v.url) onSelect(v.url); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 2, fontSize: 11, color: v.url ? 'var(--fg-dim)' : 'var(--accent)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = v.url ? 'var(--fg-dim)' : 'var(--accent)')}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BottomChrome({ theme, setTheme, font, setFont, onTimeTravel, themeLocked, fontLocked, onToggleThemeLock, onToggleFontLock }: { theme: string; setTheme: (t: string) => void; font: FontId; setFont: (f: FontId) => void; onTimeTravel: (url: string) => void; themeLocked: boolean; fontLocked: boolean; onToggleThemeLock: () => void; onToggleFontLock: () => void }) {
  const FONT_LABELS: Record<FontId, string> = {
    mono: 'Geist Mono',
    serif: 'Newsreader',
    sans: 'DM Sans',
    dys: 'OpenDyslexic',
    apfel: 'Apfel Grotezk',
  };
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'var(--bg)', padding: '8px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: 'var(--fg-faint)' }}>© 2026 Hudson Paine</span>
        <a href="https://github.com/hudbud/hudbud" target="_blank" rel="noopener" style={{ color: 'var(--fg-dim)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}>github</a>
        <a href="/resources" style={{ color: 'var(--fg-dim)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}>resources</a>
        <TimeTravelSelector onSelect={onTimeTravel} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-dim)' }}>
          <span>type set in:</span>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value as FontId)}
            style={{ background: 'transparent', border: 'none', color: 'var(--fg)', fontSize: 11, cursor: 'pointer', padding: '2px 4px' }}
          >
            {(Object.keys(FONT_LABELS) as FontId[]).map((f) => (
              <option key={f} value={f}>{FONT_LABELS[f]}</option>
            ))}
          </select>
          <button
            onClick={onToggleFontLock}
            title={fontLocked ? 'font locked (click to unlock)' : 'font randomizes on reload (click to lock)'}
            style={{ color: fontLocked ? 'var(--accent)' : 'var(--fg-faint)', fontSize: 11, lineHeight: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = fontLocked ? 'var(--accent)' : 'var(--fg-faint)')}
          >
            {fontLocked ? <Lock size={12} weight="fill" /> : <LockOpen size={12} weight="fill" />}
          </button>
        </div>
        {THEME_PAIRS[theme] && (
          <button
            onClick={() => setTheme(THEME_PAIRS[theme])}
            title={THEME_PAIRS[theme].includes('dark') ? 'switch to dark' : 'switch to light'}
            style={{ color: 'var(--fg-dim)', fontSize: 13, lineHeight: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
          >
            {THEME_PAIRS[theme].includes('dark') ? <Moon size={13} weight="fill" /> : <Sun size={13} weight="fill" />}
          </button>
        )}
        <button
          onClick={() => { const r = MT_THEMES[Math.floor(Math.random() * MT_THEMES.length)]; setTheme(r.name); }}
          title="random theme"
          style={{ color: 'var(--fg-dim)', fontSize: 13, lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
        >
          <Shuffle size={13} weight="fill" />
        </button>
        <ThemeChrome theme={theme} setTheme={setTheme} />
        <button
          onClick={onToggleThemeLock}
          title={themeLocked ? 'theme locked (click to unlock)' : 'theme randomizes on reload (click to lock)'}
          style={{ color: themeLocked ? 'var(--accent)' : 'var(--fg-faint)', fontSize: 11, lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = themeLocked ? 'var(--accent)' : 'var(--fg-faint)')}
        >
          {themeLocked ? <Lock size={12} weight="fill" /> : <LockOpen size={12} weight="fill" />}
        </button>
      </div>
    </div>
  );
}

// ---------- Tab button ----------
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: '4px 10px', color: active ? 'var(--bg)' : 'var(--fg-dim)', background: active ? 'var(--fg)' : 'transparent', borderRadius: 3, transition: 'all 0.15s' }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg-dim)'; }}
    >
      {children}
    </button>
  );
}

// ---------- Lists ----------
function ResumeList() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)', marginBottom: 10 }}>Select Clients</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {SELECT_CLIENTS.map((c) => (
            <span key={c} style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{c}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {RESUME.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 20, padding: '10px 0', fontSize: 12, color: 'var(--fg-dim)', alignItems: 'baseline' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.years}</span>
            <span style={{ color: 'var(--fg)', fontSize: 13 }}>{r.role}</span>
            <span>{r.org}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 18, fontSize: 11 }}>
        {LINKS.map((l) => (
          <a key={l.label} href={l.href} style={{ color: 'var(--fg-dim)', borderBottom: '1px dashed var(--fg-faint)', paddingBottom: 1 }}>↗ {l.label}</a>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'new!',
  'in-development': 'in development',
  idea: 'idea',
  dormant: 'dormant 🌋',
  stale: 'stale',
  retired: 'retired',
};

function StatusTag({ status, note }: { status: IdeaStatus; note?: string }) {
  const isHighlight = status === 'new';
  const isMuted = status === 'retired' || status === 'stale' || status === 'dormant';
  return (
    <span
      style={{
        fontSize: 11,
        color: isHighlight ? 'var(--accent)' : isMuted ? 'var(--fg-faint)' : 'var(--fg-dim)',
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {note || STATUS_LABEL[status]}
    </span>
  );
}

function IdeasList({ onOpenProject }: { onOpenProject?: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {IDEAS.map((idea, i) => {
        const external = !idea.internal;
        const isLinkable = idea.href && idea.href !== '#';
        const isInternalProject = idea.internal && idea.href && idea.href.startsWith('#');
        const dim = idea.status === 'retired' || idea.status === 'stale' || idea.status === 'dormant';

        const handleClick = isInternalProject
          ? (e: any) => { e.preventDefault(); onOpenProject?.(idea.href!.slice(1)); }
          : undefined;

        const Wrapper: any = isLinkable || isInternalProject ? 'a' : 'div';
        const wrapperProps: any = isInternalProject
          ? { href: idea.href, onClick: handleClick }
          : isLinkable
            ? { href: idea.href, ...(external ? { target: '_blank', rel: 'noopener' } : {}) }
            : {};

        return (
          <Wrapper
            key={idea.title}
            {...wrapperProps}
            style={{
              display: 'block',
              padding: '14px 0',
              borderTop: i === 0 ? 'none' : '1px dashed var(--rule)',
              color: dim ? 'var(--fg-dim)' : 'var(--fg)',
              transition: 'color 0.15s',
              cursor: (isLinkable || isInternalProject) ? 'pointer' : 'default',
            }}
            onMouseEnter={(isLinkable || isInternalProject) ? (e: any) => (e.currentTarget.style.color = 'var(--accent)') : undefined}
            onMouseLeave={(isLinkable || isInternalProject) ? (e: any) => (e.currentTarget.style.color = dim ? 'var(--fg-dim)' : 'var(--fg)') : undefined}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
              <span style={{ fontSize: 13 }}>{idea.title}</span>
              <StatusTag status={idea.status} note={idea.statusNote} />
            </div>
            {idea.desc && (
              <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginTop: 4, lineHeight: 1.5 }}>{idea.desc}</div>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}

function PostList({ posts, activePost, setActivePost }: { posts: Post[]; activePost: Post | null; setActivePost: (p: Post | null) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {posts.map((p) => {
        const isActive = activePost && activePost.title === p.title;
        return (
          <button
            key={p.title}
            onClick={() => setActivePost(isActive ? null : { ...p, tag: 'thoughts' } as Post)}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, padding: '10px 0', textAlign: 'left', alignItems: 'baseline', color: isActive ? 'var(--accent)' : 'var(--fg)', transition: 'color 0.15s' }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--fg)'; }}
          >
            <span style={{ fontSize: 13 }}>{p.title}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>{p.date}</span>
          </button>
        );
      })}
    </div>
  );
}

function LifeList({ posts, activePost, setActivePost }: { posts: Post[]; activePost: Post | null; setActivePost: (p: Post | null) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {posts.map((p, i) => {
        const isActive = activePost && activePost.title === p.title;
        const imgColor = p.img || '#3a434e';
        return (
          <button
            key={p.title}
            onClick={() => setActivePost(isActive ? null : { ...p, tag: 'life' } as Post)}
            style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 16, padding: '10px 0', textAlign: 'left', alignItems: 'center', color: isActive ? 'var(--accent)' : 'var(--fg)', transition: 'color 0.15s' }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--fg)'; }}
          >
            {p.feature_image ? (
              <img src={p.feature_image} alt="" style={{ width: 96, height: 58, objectFit: 'cover', borderRadius: 2 }} />
            ) : (
              <LifeImage color={imgColor} seed={i} height={58} />
            )}
            <span style={{ fontSize: 13 }}>{p.title}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>{p.date}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Bio modal ----------
function BioModal({ modalId, onClose }: { modalId: string; onClose: () => void }) {
  const content = MODAL_CONTENT[modalId];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!content) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 40px', overflowY: 'auto', animation: 'hpFade 0.2s ease' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 100%)', background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: '36px 40px 40px', boxShadow: '0 20px 80px rgba(0,0,0,0.5)', position: 'relative' }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 16, color: 'var(--fg-dim)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
        >
          close ×
        </button>
        <div style={{ fontSize: 18, color: 'var(--accent)', marginBottom: 18, lineHeight: 1.3 }}>{content.title}</div>
        {content.body.split('\n\n').map((para, i) => (
          <p key={i} className="prose" style={{ color: 'var(--fg)', marginBottom: 14, fontSize: 13, lineHeight: 1.65 }}>{para}</p>
        ))}
      </div>
    </div>
  );
}

// ---------- Bio link (hover preview on desktop, click opens modal) ----------
function BioLink({ label, modalId, onOpenModal }: { label: string; modalId: string; onOpenModal?: (id: string) => void }) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  const content = MODAL_CONTENT[modalId];

  const handleEnter = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    setShow(true);
  };
  const handleLeave = () => {
    timeoutRef.current = window.setTimeout(() => setShow(false), 200);
  };
  const handleClick = () => {
    setShow(false);
    onOpenModal?.(modalId);
  };

  return (
    <span ref={containerRef} style={{ position: 'relative', display: 'inline' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={handleClick}
        style={{ color: 'var(--accent)', textDecoration: 'none', cursor: 'pointer' }}
      >
        {label}
      </button>
      {show && content && (
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', width: 320, background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: '16px 18px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 150, animation: 'hpFade 0.15s ease' }}
        >
          <p style={{ color: 'var(--fg)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{content.preview}</p>
        </div>
      )}
    </span>
  );
}

// ---------- Left column ----------
function LeftColumn({ activeTab, setActiveTab, activePost, setActivePost, onOpenProject, onOpenBioModal, thoughts, life }: {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  activePost: Post | null;
  setActivePost: (p: Post | null) => void;
  onOpenProject: (id: string) => void;
  onOpenBioModal: (id: string) => void;
  thoughts: Post[];
  life: Post[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '56px 40px 80px 48px', height: '100%', overflowY: 'auto' }}>
      <div>
        <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 14, letterSpacing: '0.01em' }}>Hudson Paine</div>
        <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>{BIO_INTRO}</p>
        <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>{BIO_BODY}</p>
        <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>
          {BIO_BODY_2}{' '}
          <BioLink label="make stuff" modalId="make-stuff" onOpenModal={onOpenBioModal} />.{' '}
          I'm a <BioLink label="tinkerer and serial hobbyist" modalId="hobbyist" onOpenModal={onOpenBioModal} />,{' '}
          I <BioLink label="love computers" modalId="computers" onOpenModal={onOpenBioModal} />,{' '}
          I'm an <BioLink label="outdoorsman" modalId="outdoorsman" onOpenModal={onOpenBioModal} />,{' '}
          and I have strong opinions on just about everything.
        </p>
        <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>{BIO_BODY_3}</p>
        <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>{BIO_BODY_4}</p>
        <p className="prose" style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>
          <BioLink label={`${BIO_ORIGIN} →`} modalId="origin" onOpenModal={onOpenBioModal} />
        </p>
      </div>

      <div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, fontSize: 12, alignItems: 'center' }}>
          {TAGS.map((tag) => (
            <TabButton key={tag} active={activeTab === tag} onClick={() => { setActiveTab(tag); }}>
              {tag}
            </TabButton>
          ))}
        </div>

        {activeTab === 'work' && <ResumeList />}
        {activeTab === 'ideas' && <IdeasList onOpenProject={onOpenProject} />}
        {activeTab === 'thoughts' && <PostList posts={thoughts} activePost={activePost} setActivePost={setActivePost} />}
        {activeTab === 'life' && <LifeList posts={life} activePost={activePost} setActivePost={setActivePost} />}
      </div>

    </div>
  );
}

// ---------- Tile grid with drift ----------
function TileGrid({ density, onPick }: { density: string; onPick: (tile: Tile) => void }) {
  const [cols] = density.split('x').map(Number);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const velocityRef = useRef(0);
  const targetVelRef = useRef(0.25);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const k = targetVelRef.current === 0 ? 0.03 : 0.06;
      velocityRef.current = velocityRef.current + (targetVelRef.current - velocityRef.current) * k;
      if (Math.abs(velocityRef.current) > 0.002) {
        const max = el.scrollHeight - el.clientHeight;
        let next = el.scrollTop + velocityRef.current * (dt / 16.67);
        if (max > 0) {
          if (next >= max - 0.5) next = 0;
          else if (next < 0) next = max;
        }
        el.scrollTop = next;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleEnter = useCallback((id: string) => {
    setHoverId(id);
    targetVelRef.current = 0;
  }, []);
  const handleLeave = useCallback(() => {
    setHoverId(null);
    targetVelRef.current = 0.25;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: number | null = null;
    const pause = () => {
      targetVelRef.current = 0;
      if (timer !== null) clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (hoverId === null) targetVelRef.current = 0.25;
      }, 2000);
    };
    el.addEventListener('wheel', pause, { passive: true });
    el.addEventListener('touchmove', pause, { passive: true });
    return () => {
      el.removeEventListener('wheel', pause);
      el.removeEventListener('touchmove', pause);
      if (timer !== null) clearTimeout(timer);
    };
  }, [hoverId]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div
        ref={containerRef}
        className="hp-scroll"
        style={{
          position: 'relative',
          height: '100%',
          overflowY: 'auto',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 20px, #000 calc(100% - 90px), transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 20px, #000 calc(100% - 90px), transparent 100%)',
          padding: '32px 64px 80px 56px',
        }}
      >
        <style>{`.hp-scroll::-webkit-scrollbar { display: none; } .hp-scroll { scrollbar-width: none; }`}</style>

        <div style={{ columnCount: cols, columnGap: '10px' }}>
          {TILES.map((t) => {
            const seed = t.id.charCodeAt(1) + t.id.charCodeAt(2);
            const aspect = [1, 1.25, 1.45, 0.85, 1.1, 1.6, 0.95][seed % 7];
            const isHovered = hoverId === t.id;
            const anyHovered = hoverId !== null;
            return (
              <button
                key={t.id}
                data-tile-id={t.id}
                onClick={() => onPick(t)}
                onMouseEnter={() => handleEnter(t.id)}
                onMouseLeave={handleLeave}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: `1 / ${aspect}`,
                  background: t.color,
                  opacity: anyHovered ? (isHovered ? 1 : 0.3) : 0.88,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 2,
                  transition: 'opacity 0.45s ease',
                  cursor: 'pointer',
                  marginBottom: 10,
                  breakInside: 'avoid',
                }}
              >
                <TileMedia tile={t} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Tile lightbox ----------
function TileLightbox({ tile, onClose }: { tile: Tile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 18, animation: 'hpFade 0.2s ease' }}
    >
      <style>{`@keyframes hpFade { from { opacity: 0; } to { opacity: 1; } }`}</style>

      <button
        onClick={onClose}
        style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
      >
        [ close × ]
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(78vw, 1100px)', maxHeight: '70vh', aspectRatio: '4 / 3', background: tile.color, overflow: 'hidden', borderRadius: 3, boxShadow: '0 20px 80px rgba(0,0,0,0.5)' }}
      >
        <TileMedia tile={tile} />
        {!tile.image && (
          <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            fig. 01 / placeholder
          </div>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(78vw, 1100px)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: '#fff', paddingTop: 4 }}>
        <div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.95)', letterSpacing: '0.01em' }}>{tile.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{tile.kind} · {tile.medium}</div>
          {tile.caption && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 10, maxWidth: 520 }}>{tile.caption}</div>}
          {tile.href && (
            <a href={tile.href} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 10, display: 'inline-block', borderBottom: '1px dashed rgba(255,255,255,0.35)' }}>
              ↗ visit
            </a>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>{tile.year}</div>
      </div>
    </div>
  );
}

// ---------- Spritz speed reader ----------
function SpritzReader({ html, onClose }: { html: string; onClose: () => void }) {
  const [words, setWords] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || '';
    setWords(text.split(/\s+/).filter(Boolean));
  }, [html]);

  const baseMs = 60000 / wpm;

  const getDelay = (word: string) => {
    if (word.length > 8) return baseMs * 1.4;
    if (/[.!?;]$/.test(word)) return baseMs * 2;
    if (/[,:]$/.test(word)) return baseMs * 1.5;
    return baseMs;
  };

  const stop = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const step = useCallback(() => {
    setIndex((prev) => {
      if (prev >= words.length - 1) { stop(); return prev; }
      return prev + 1;
    });
  }, [words.length, stop]);

  useEffect(() => {
    if (!playing) return;
    const word = words[index];
    if (!word) { stop(); return; }
    const delay = getDelay(word);
    timerRef.current = window.setTimeout(step, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, index, words, step]);

  const play = () => {
    if (index >= words.length - 1) setIndex(0);
    setPlaying(true);
  };

  const getPivot = (word: string) => {
    if (word.length <= 1) return 0;
    return Math.floor(word.length / 2) - 1;
  };

  const currentWord = words[index] || '';
  const pivot = getPivot(currentWord);

  return (
    <div style={{ background: 'var(--tile)', borderRadius: 4, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 24, position: 'relative', minWidth: 240, textAlign: 'center' }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--accent)', opacity: 0.3 }} />
          <span style={{ color: 'var(--fg)' }}>{currentWord.slice(0, pivot)}</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{currentWord[pivot] || ''}</span>
          <span style={{ color: 'var(--fg)' }}>{currentWord.slice(pivot + 1)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => playing ? stop() : play()}
          style={{ background: 'var(--accent)', color: 'var(--bg)', borderRadius: 3, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={words.length - 1}
          value={index}
          onChange={(e) => { stop(); setIndex(Number(e.target.value)); }}
          style={{ flex: 1 }}
        />
        <select
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
          style={{ background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 3, padding: '3px 6px', fontSize: 11, color: 'var(--fg)' }}
        >
          <option value={200}>200</option>
          <option value={300}>300</option>
          <option value={400}>400</option>
          <option value={500}>500</option>
          <option value={600}>600</option>
        </select>
        <button
          onClick={() => { stop(); onClose(); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '4px 8px' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ---------- Typing test (MonkeyType-style) ----------
function TypingTest({ html, onClose }: { html: string; onClose: () => void }) {
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [wordResults, setWordResults] = useState<('correct' | 'incorrect' | 'pending')[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || '';
    const w = text.split(/\s+/).filter(Boolean).slice(0, 100);
    setWords(w);
    setWordResults(w.map(() => 'pending'));
  }, [html]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [words]);

  const elapsed = started && !finished ? (Date.now() - startTime) / 1000 / 60 : 0;
  const wpm = elapsed > 0 ? Math.round((correctChars / 5) / elapsed) : 0;
  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;

  const finalElapsed = finished ? (Date.now() - startTime) / 1000 / 60 : 0;
  const finalWpm = finished ? Math.round((correctChars / 5) / finalElapsed) : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (finished) return;

    if (!started) {
      setStarted(true);
      setStartTime(Date.now());
    }

    if (e.key === ' ') {
      e.preventDefault();
      const currentWord = words[wordIndex];
      const isCorrect = input === currentWord;
      const newResults = [...wordResults];
      newResults[wordIndex] = isCorrect ? 'correct' : 'incorrect';
      setWordResults(newResults);
      setCorrectChars((c) => c + (isCorrect ? currentWord.length + 1 : 0));
      setTotalChars((c) => c + currentWord.length + 1);

      if (wordIndex >= words.length - 1) {
        setFinished(true);
        return;
      }

      setWordIndex((i) => i + 1);
      setCharIndex(0);
      setInput('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (finished) return;
    const val = e.target.value;
    setInput(val);
    setCharIndex(val.length);
  };

  const reset = () => {
    setInput('');
    setWordIndex(0);
    setCharIndex(0);
    setStarted(false);
    setFinished(false);
    setStartTime(0);
    setCorrectChars(0);
    setTotalChars(0);
    setWordResults(words.map(() => 'pending'));
    inputRef.current?.focus();
  };

  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const word = activeWordRef.current;
      const offsetTop = word.offsetTop - container.offsetTop;
      if (offsetTop > container.clientHeight * 0.6) {
        container.scrollTop = offsetTop - 40;
      }
    }
  }, [wordIndex]);

  return (
    <div style={{ background: 'var(--tile)', borderRadius: 4, padding: 20, marginBottom: 20 }}>
      {finished ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, color: 'var(--accent)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{finalWpm} wpm</div>
          <div style={{ fontSize: 13, color: 'var(--fg-dim)', marginTop: 8 }}>{accuracy}% accuracy · {words.length} words</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={reset} style={{ background: 'var(--accent)', color: 'var(--bg)', borderRadius: 3, padding: '6px 14px', fontSize: 11, fontWeight: 600 }}>restart</button>
            <button onClick={onClose} style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '6px 14px' }}>done</button>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            onClick={() => inputRef.current?.focus()}
            style={{ position: 'relative', fontSize: 18, lineHeight: 2, maxHeight: 120, overflow: 'hidden', cursor: 'text', marginBottom: 12 }}
          >
            {words.map((word, wi) => {
              const isCurrent = wi === wordIndex;
              const result = wordResults[wi];
              return (
                <span key={wi} ref={isCurrent ? activeWordRef : undefined} style={{ marginRight: 8, display: 'inline-block' }}>
                  {word.split('').map((char, ci) => {
                    let color = 'var(--fg-faint)';
                    if (result === 'correct') color = 'var(--fg)';
                    else if (result === 'incorrect') color = 'rgba(255,100,100,0.9)';
                    else if (isCurrent) {
                      if (ci < input.length) {
                        color = input[ci] === char ? 'var(--fg)' : 'rgba(255,100,100,0.9)';
                      }
                    }
                    return (
                      <span key={ci} style={{ color, position: 'relative' }}>
                        {isCurrent && ci === charIndex && (
                          <span style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: 2, background: 'var(--accent)', animation: 'hpBlink 1s step-end infinite' }} />
                        )}
                        {char}
                      </span>
                    );
                  })}
                  {isCurrent && charIndex >= word.length && (
                    <span style={{ position: 'relative' }}>
                      {input.slice(word.length).split('').map((c, i) => (
                        <span key={i} style={{ color: 'rgba(255,100,100,0.7)' }}>{c}</span>
                      ))}
                      <span style={{ position: 'absolute', right: -1, top: 2, bottom: 2, width: 2, background: 'var(--accent)', animation: 'hpBlink 1s step-end infinite' }} />
                    </span>
                  )}
                </span>
              );
            })}
            <style>{`@keyframes hpBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              {started && <span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{wpm} wpm</span>}
              {started && <span style={{ color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>{accuracy}%</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reset} style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 10px' }}>restart</button>
              <button onClick={onClose} style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '4px 8px' }}>done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Post panel (replaces lightbox) ----------
function PostPanel({ post, onClose }: { post: Post & { tag?: string }; onClose: () => void }) {
  const [showSpritz, setShowSpritz] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const postHtml = post.html || `<p>${post.excerpt}</p>`;
  const wordCount = postHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 230));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isLife = post.tag === 'life';
  const hasImage = isLife && (post.img || post.feature_image);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '56px 56px 100px 48px', position: 'relative' }}>
      <div style={{ color: 'var(--fg-faint)', fontSize: 11, marginBottom: 8 }}>
        [{post.tag || 'post'}] · {post.date}
      </div>
      <div style={{ fontSize: 26, color: 'var(--accent)', marginBottom: 14, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
        {post.title}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => { setShowSpritz(!showSpritz); setShowTyping(false); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showSpritz ? 'hide speed reader' : '⚡ speed read'}
        </button>
        <button
          onClick={() => { setShowTyping(!showTyping); setShowSpritz(false); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showTyping ? 'hide typing test' : '⌨ typing test'}
        </button>
      </div>

      {showSpritz && <SpritzReader html={postHtml} onClose={() => setShowSpritz(false)} />}
      {showTyping && <TypingTest html={postHtml} onClose={() => setShowTyping(false)} />}

      {hasImage && (
        <div style={{ marginBottom: 24 }}>
          {post.feature_image ? (
            <img src={post.feature_image} alt="" style={{ width: '100%', borderRadius: 2 }} />
          ) : (
            <LifeImage color={post.img || '#3a434e'} seed={post.title.length} height={260} />
          )}
        </div>
      )}

      <div className="prose" style={{ color: 'var(--fg)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: postHtml }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--rule)', fontSize: 11, color: 'var(--fg-dim)' }}>
        <em>~{minutes} min read</em>
        {post.slug && (
          <a
            href={`/posts/${post.slug}`}
            style={{ color: 'var(--fg-dim)', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
          >
            Read full post →
          </a>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <button
          onClick={onClose}
          style={{ pointerEvents: 'auto', background: 'var(--fg)', color: 'var(--bg)', borderRadius: 20, padding: '8px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fg)')}
        >
          ✕ Close
        </button>
      </div>
    </div>
  );
}

// ---------- Project panel ----------
const PROJECT_CONTENT: Record<string, { title: string; html: string; subtitle?: string }> = {
  'split-keyboard': { title: 'A Better Mechanical Keyboard', html: KEYBOARD_HTML, subtitle: 'senior project, 2019' },
};

function ProjectPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [showSpritz, setShowSpritz] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (projectId === 'freezer-martini') {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '32px 24px 100px', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, padding: '0 8px' }}>
          <div style={{ color: 'var(--fg-faint)', fontSize: 11 }}>[project] · tool</div>
          <a
            href="/freezer-martini"
            style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 10px' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
          >
            ↗ expand full page
          </a>
        </div>
        <FreezerMartini embedded />
        <div style={{ position: 'sticky', bottom: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <button
            onClick={onClose}
            style={{ pointerEvents: 'auto', background: 'var(--fg)', color: 'var(--bg)', borderRadius: 20, padding: '8px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fg)')}
          >
            ✕ Close
          </button>
        </div>
      </div>
    );
  }

  const project = PROJECT_CONTENT[projectId];
  if (!project) return null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '56px 48px 100px', position: 'relative' }}>
      <div style={{ color: 'var(--fg-faint)', fontSize: 11, marginBottom: 8 }}>
        [project] · {project.subtitle || ''}
      </div>
      <div style={{ fontSize: 26, color: 'var(--accent)', marginBottom: 14, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
        {project.title}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => { setShowSpritz(!showSpritz); setShowTyping(false); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showSpritz ? 'hide speed reader' : '⚡ speed read'}
        </button>
        <button
          onClick={() => { setShowTyping(!showTyping); setShowSpritz(false); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showTyping ? 'hide typing test' : '⌨ typing test'}
        </button>
      </div>

      {showSpritz && <SpritzReader html={project.html} onClose={() => setShowSpritz(false)} />}
      {showTyping && <TypingTest html={project.html} onClose={() => setShowTyping(false)} />}

      <div className="prose" style={{ color: 'var(--fg)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: project.html }} />

      <div style={{ position: 'sticky', bottom: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <button
          onClick={onClose}
          style={{ pointerEvents: 'auto', background: 'var(--fg)', color: 'var(--bg)', borderRadius: 20, padding: '8px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fg)')}
        >
          ✕ Close
        </button>
      </div>
    </div>
  );
}

// ---------- App ----------
interface PortfolioProps {
  thoughts?: Post[];
  life?: Post[];
}

export default function Portfolio({ thoughts: thoughtsProp, life: lifeProp }: PortfolioProps) {
  const thoughts = thoughtsProp ?? [];
  const life = lifeProp ?? [];

  const [theme, setThemeRaw] = useState(getInitialTheme);
  const [font, setFontRaw] = useState<FontId>(getInitialFont);
  const [themeLocked, setThemeLocked] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('hp-lock-theme'));
  const [fontLocked, setFontLocked] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('hp-lock-font'));
  const [activeTab, setActiveTab] = useState<TabId>('ideas');

  const setTheme = (t: string) => { setThemeRaw(t); localStorage.setItem('hp-theme', t); };
  const setFont = (f: FontId) => { setFontRaw(f); localStorage.setItem('hp-font', f); };
  const toggleThemeLock = () => {
    const next = !themeLocked;
    setThemeLocked(next);
    if (next) localStorage.setItem('hp-lock-theme', '1');
    else localStorage.removeItem('hp-lock-theme');
  };
  const toggleFontLock = () => {
    const next = !fontLocked;
    setFontLocked(next);
    if (next) localStorage.setItem('hp-lock-font', '1');
    else localStorage.removeItem('hp-lock-font');
  };

  const [activeTile, setActiveTileRaw] = useState<Tile | null>(null);
  const [activePost, setActivePostRaw] = useState<(Post & { tag?: string }) | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [bioModal, setBioModal] = useState<string | null>(null);
  const [timeTravelUrl, setTimeTravelUrl] = useState<string | null>(null);

  const setActiveTile = (t: Tile | null) => { setActiveTileRaw(t); setActivePostRaw(null); };
  const setActivePost = (p: Post | null) => { setActivePostRaw(p as (Post & { tag?: string }) | null); setActiveTileRaw(null); setActiveProject(null); };
  const openProject = (id: string) => { setActiveProject(id); setActivePostRaw(null); setActiveTileRaw(null); };
  const closeRightPanel = () => { setActivePostRaw(null); setActiveProject(null); };

  useEffect(() => {
    const mt = MT_THEMES.find((t) => t.name === theme) || MT_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--bg', mt.bg);
    root.style.setProperty('--bg-inner', mt.bgInner);
    root.style.setProperty('--fg', mt.fg);
    root.style.setProperty('--fg-dim', mt.dim);
    root.style.setProperty('--fg-faint', mt.dim);
    root.style.setProperty('--accent', mt.accent);
    root.style.setProperty('--rule', mt.dim);
    root.style.setProperty('--tile', mt.bgInner);
  }, [theme]);

  useEffect(() => {
    document.body.dataset.font = font;
  }, [font]);

  const rightContent = activePost
    ? <PostPanel post={activePost} onClose={closeRightPanel} />
    : activeProject
      ? <ProjectPanel projectId={activeProject} onClose={closeRightPanel} />
      : <TileGrid density={DEFAULTS.density} onPick={setActiveTile} />;

  return (
    <div style={{ height: '100vh', padding: 20, background: 'var(--bg)', overflow: 'hidden' }}>
      <div
        style={{
          height: 'calc(100vh - 40px)',
          background: 'var(--bg-inner)',
          borderRadius: 4,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <LeftColumn
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activePost={activePost}
          setActivePost={setActivePost}
          onOpenProject={openProject}
          onOpenBioModal={setBioModal}
          thoughts={thoughts}
          life={life}
        />

        <div style={{ height: '100%', overflow: 'hidden' }}>{rightContent}</div>
      </div>

      <BottomChrome theme={theme} setTheme={setTheme} font={font} setFont={setFont} onTimeTravel={setTimeTravelUrl} themeLocked={themeLocked} fontLocked={fontLocked} onToggleThemeLock={toggleThemeLock} onToggleFontLock={toggleFontLock} />

      {activeTile && <TileLightbox tile={activeTile} onClose={() => setActiveTile(null)} />}
      {bioModal && <BioModal modalId={bioModal} onClose={() => setBioModal(null)} />}
      {timeTravelUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>viewing: {timeTravelUrl}</span>
            <button
              onClick={() => setTimeTravelUrl(null)}
              style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 12px' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
            >
              ✕ Back to current site
            </button>
          </div>
          <iframe src={timeTravelUrl} style={{ flex: 1, border: 'none', width: '100%' }} />
        </div>
      )}
    </div>
  );
}
