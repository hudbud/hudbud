import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BIO } from '../data/bio';
import { RESUME, LINKS } from '../data/resume';
import { IDEAS, type IdeaStatus } from '../data/ideas';
import { TILES, type Tile } from '../data/tiles';
import { MT_THEMES } from '../data/themes';
import { THOUGHTS_FALLBACK, LIFE_FALLBACK, type Post } from '../data/posts';

type TabId = 'ideas' | 'life' | 'thoughts' | 'work';
type FontId = 'mono' | 'serif' | 'sans' | 'dys' | 'apfel';

const TAGS: TabId[] = ['ideas', 'life', 'thoughts', 'work'];

const DEFAULTS = {
  theme: 'bushido',
  density: '3x5',
  font: 'mono' as FontId,
};

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
  const cur = MT_THEMES.find((t) => t.name === theme) || MT_THEMES[0];
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
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: 4, minWidth: 200, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: '70vh', overflowY: 'auto' }}>
          {MT_THEMES.map((t) => (
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

function TopChrome({ theme, setTheme, font, setFont }: { theme: string; setTheme: (t: string) => void; font: FontId; setFont: (f: FontId) => void }) {
  return (
    <div style={{ position: 'fixed', top: 32, right: 36, zIndex: 100, display: 'flex', alignItems: 'center', gap: 6 }}>
      <FontSwitcher font={font} setFont={setFont} />
      <ThemeChrome theme={theme} setTheme={setTheme} />
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

function IdeasList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {IDEAS.map((idea, i) => {
        const external = !idea.internal;
        const isLinkable = idea.href && idea.href !== '#';
        const dim = idea.status === 'retired' || idea.status === 'stale' || idea.status === 'dormant';
        const Wrapper: any = isLinkable ? 'a' : 'div';
        const wrapperProps: any = isLinkable
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
              cursor: isLinkable ? 'pointer' : 'default',
            }}
            onMouseEnter={isLinkable ? (e: any) => (e.currentTarget.style.color = 'var(--accent)') : undefined}
            onMouseLeave={isLinkable ? (e: any) => (e.currentTarget.style.color = dim ? 'var(--fg-dim)' : 'var(--fg)') : undefined}
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

// ---------- Left column ----------
function LeftColumn({ activeTab, setActiveTab, activePost, setActivePost, thoughts, life }: {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  activePost: Post | null;
  setActivePost: (p: Post | null) => void;
  thoughts: Post[];
  life: Post[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '56px 56px 56px 64px', maxWidth: 640 }}>
      <div>
        <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 14, letterSpacing: '0.01em' }}>Hudson Paine</div>
        <p className="prose" style={{ color: 'var(--fg)', margin: 0, maxWidth: '52ch' }}>{BIO}</p>
      </div>

      <div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, fontSize: 12, alignItems: 'center' }}>
          {TAGS.map((tag) => (
            <TabButton key={tag} active={activeTab === tag} onClick={() => { setActiveTab(tag); setActivePost(null); }}>
              {tag}
            </TabButton>
          ))}
        </div>

        {activeTab === 'work' && <ResumeList />}
        {activeTab === 'ideas' && <IdeasList />}
        {activeTab === 'thoughts' && <PostList posts={thoughts} activePost={activePost} setActivePost={setActivePost} />}
        {activeTab === 'life' && <LifeList posts={life} activePost={activePost} setActivePost={setActivePost} />}
      </div>

      <div style={{ color: 'var(--fg-faint)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', paddingTop: 20 }}>
        paine.design · mmxxvi · no cookies, no tracking
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
    <div style={{ position: 'relative', height: '100vh' }}>
      <div
        ref={containerRef}
        className="hp-scroll"
        style={{
          position: 'relative',
          height: '100vh',
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

// ---------- Post lightbox ----------
function PostLightbox({ post, onClose }: { post: Post & { tag?: string }; onClose: () => void }) {
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

  const isLife = post.tag === 'life';
  const hasImage = isLife && (post.img || post.feature_image);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 40px', overflowY: 'auto', animation: 'hpFade 0.2s ease' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(720px, 100%)', background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: '40px 48px 44px', boxShadow: '0 20px 80px rgba(0,0,0,0.5)', position: 'relative' }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 16, color: 'var(--fg-dim)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
        >
          close ×
        </button>

        <div style={{ color: 'var(--fg-faint)', fontSize: 11, marginBottom: 8 }}>
          [{post.tag || 'post'}] · {post.date}
        </div>
        <div style={{ fontSize: 26, color: 'var(--accent)', marginBottom: 20, lineHeight: 1.2, letterSpacing: '-0.005em' }}>
          {post.title}
        </div>

        {hasImage && (
          <div style={{ marginBottom: 24 }}>
            {post.feature_image ? (
              <img src={post.feature_image} alt="" style={{ width: '100%', borderRadius: 2 }} />
            ) : (
              <LifeImage color={post.img || '#3a434e'} seed={post.title.length} height={260} />
            )}
          </div>
        )}

        {post.html ? (
          <div className="prose" style={{ color: 'var(--fg)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: post.html }} />
        ) : (
          <>
            <p className="prose" style={{ color: 'var(--fg)', marginBottom: 16, fontSize: 14 }}>{post.excerpt}</p>
            <p className="prose" style={{ color: 'var(--fg)', marginBottom: 16 }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus.
            </p>
            <p className="prose" style={{ color: 'var(--fg)', marginBottom: 16 }}>
              Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac sollicitudus ante pulvinar.
            </p>
          </>
        )}
        <p className="prose" style={{ color: 'var(--fg-dim)', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--rule)', fontSize: 11 }}>
          <em>Posted via Ghost · ~4 min read</em>
        </p>
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
  const thoughts = thoughtsProp && thoughtsProp.length > 0 ? thoughtsProp : THOUGHTS_FALLBACK;
  const life = lifeProp && lifeProp.length > 0 ? lifeProp : LIFE_FALLBACK;

  const [theme, setTheme] = useState(DEFAULTS.theme);
  const [font, setFont] = useState<FontId>(DEFAULTS.font);
  const [activeTab, setActiveTab] = useState<TabId>('ideas');

  const [activeTile, setActiveTileRaw] = useState<Tile | null>(null);
  const [activePost, setActivePostRaw] = useState<(Post & { tag?: string }) | null>(null);

  const setActiveTile = (t: Tile | null) => { setActiveTileRaw(t); setActivePostRaw(null); };
  const setActivePost = (p: Post | null) => { setActivePostRaw(p as (Post & { tag?: string }) | null); setActiveTileRaw(null); };

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

  return (
    <div style={{ minHeight: '100vh', padding: 20, background: 'var(--bg)' }}>
      <div
        style={{
          minHeight: 'calc(100vh - 40px)',
          background: 'var(--bg-inner)',
          borderRadius: 4,
          display: 'grid',
          gridTemplateColumns: 'minmax(520px, 1fr) minmax(520px, 1fr)',
          position: 'relative',
        }}
      >
        <LeftColumn
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activePost={activePost}
          setActivePost={setActivePost}
          thoughts={thoughts}
          life={life}
        />

        <div>
          <TileGrid density={DEFAULTS.density} onPick={setActiveTile} />
        </div>
      </div>

      <TopChrome theme={theme} setTheme={setTheme} font={font} setFont={setFont} />

      {activeTile && <TileLightbox tile={activeTile} onClose={() => setActiveTile(null)} />}
      {activePost && <PostLightbox post={activePost} onClose={() => setActivePost(null)} />}
    </div>
  );
}
