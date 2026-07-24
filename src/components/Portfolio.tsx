import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Menu } from 'bloom-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { BIO_LEAD, BIO_BODY, BIO_BODY_2, BIO_ORIGIN, MODAL_CONTENT } from '../data/bio';
import { RESUME, LINKS, SELECT_CLIENTS } from '../data/resume';
import { IDEAS, type IdeaStatus } from '../data/ideas';
import { TILES, type Tile } from '../data/tiles';
import { MT_THEMES, THEME_PAIRS } from '../data/themes';
import { type Post } from '../data/posts';
import { KEYBOARD_HTML } from '../data/keyboard';
import FreezerMartini from './FreezerMartini';
import { Lock, LockOpen, Shuffle, Moon, Sun, CaretUp, Lightning, Keyboard, Sparkle, ClockCounterClockwise, BookOpen, LinkSimple, Palette } from '@phosphor-icons/react';

type TabId = 'ideas' | 'life' | 'work' | 'archive';
type FontId = 'mono' | 'serif' | 'sans' | 'dys' | 'apfel' | 'outfit';

const TAGS: TabId[] = ['ideas', 'work', 'life']; // landing page buttons
const ALL_TABS: TabId[] = ['ideas', 'work', 'life', 'archive']; // tab bar when selected

const FONT_IDS: FontId[] = ['mono', 'serif', 'sans', 'dys', 'apfel', 'outfit'];

const DEFAULTS = {
  theme: 'earthsong',
  density: '3x5',
  font: 'apfel' as FontId,
};

// NOTE: these must return the same value on the server render and the client's
// first hydration render (no window/localStorage access) — the real theme/font
// choice is applied post-mount from window.__hpInitial, which the inline head
// script (see Layout.astro) already painted onto the page before hydration.
function getInitialTheme(): string {
  return DEFAULTS.theme;
}

function getInitialFont(): FontId {
  return DEFAULTS.font;
}

interface HpInitial {
  theme: string;
  font: FontId;
}

function readHpInitial(): HpInitial | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __hpInitial?: HpInitial }).__hpInitial ?? null;
}

// ---------- Site mark (theme-aware) ----------
// Original artwork supplied as a fixed-color SVG; fills are remapped to the
// theme tokens so the mark recolors with every theme. The three arc colors
// become stepped opacities of the single theme accent.
function HudMark({ size = 44, onClick }: { size?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} aria-label="home" style={{ display: 'block', padding: 0, cursor: 'pointer', lineHeight: 0 }}>
      <svg width={size} height={size} viewBox="0 0 330 329" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M203.833 290.257L126.128 290.242L119.865 283.999L210.104 284.006L203.833 290.257Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M191.322 302.728L138.66 302.729L132.395 296.484L197.579 296.491L191.322 302.728Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.794 315.217L151.188 315.219L144.924 308.974L185.051 308.979L178.794 315.217Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M164.992 328.975L157.453 321.46L172.526 321.465L164.992 328.975Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M113.13 177.859L51.2288 177.843L64.4456 190.991L45.5201 209.857L-1.88858e-05 164.479L45.4981 119.124L64.4263 137.993L51.2179 151.16L85.8397 151.164C91.5678 117.699 118.013 91.3369 151.569 85.6408L151.564 51.1284L138.356 64.2946L119.428 45.4259L164.94 0.0566261L210.526 45.3858L191.6 64.2519L178.389 51.0819L178.393 85.595C211.958 91.3071 238.414 117.68 244.144 151.14L278.712 151.147L265.502 137.978L284.427 119.112L329.929 164.556L284.431 209.911L265.503 191.042L278.705 177.899L256.937 177.893L256.929 177.885L216.79 177.868C217.914 173.586 218.518 169.097 218.527 164.467C218.518 135.182 194.334 111.074 164.956 111.064C135.563 111.067 111.388 135.166 111.399 164.452C111.406 169.069 112.003 173.567 113.13 177.859Z" fill="var(--fg-dim)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.362 277.76L151.603 277.758L151.606 271.51L178.365 271.512L178.362 277.76Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.355 265.278L151.61 265.262L151.6 259.027L178.359 259.029L178.355 265.278Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M213.96 227.823L116.013 227.796C113.499 225.854 111.096 223.771 108.822 221.561L221.142 221.575C218.881 223.789 216.486 225.871 213.96 227.823Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M148.757 215.326L103.083 215.307C101.421 213.311 99.8655 211.223 98.4078 209.062L135.706 209.076C139.718 211.717 144.107 213.83 148.757 215.326Z" fill="var(--fg)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M190.673 240.308L139.325 240.291C134.462 238.639 129.804 236.54 125.4 234.046L204.58 234.061C200.19 236.558 195.541 238.655 190.673 240.308Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M127.879 202.832L94.5861 202.822C93.4634 200.797 92.4287 198.719 91.4989 196.576L122.317 196.58C124.009 198.804 125.86 200.904 127.879 202.832Z" fill="color-mix(in srgb, var(--accent) 50%, var(--fg))"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.363 252.779L151.604 252.778L151.607 246.53L178.367 246.531L178.363 252.779Z" fill="var(--fg-faint)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M118.212 190.334L89.0445 190.336C88.3474 188.284 87.716 186.211 87.1793 184.092L115.212 184.091C116.071 186.248 117.079 188.328 118.212 190.334Z" fill="var(--accent)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M226.884 215.331L181.14 215.327C185.798 213.833 190.181 211.724 194.201 209.084L231.551 209.093C230.103 211.242 228.538 213.331 226.884 215.331Z" fill="var(--fg)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M235.375 202.84L202.035 202.839C204.044 200.91 205.915 198.816 207.606 196.598L238.454 196.604C237.521 198.728 236.49 200.811 235.375 202.84Z" fill="color-mix(in srgb, var(--accent) 50%, var(--fg))"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M240.901 190.358L211.723 190.35C212.842 188.354 213.845 186.27 214.716 184.112L242.76 184.122C242.233 186.227 241.603 188.315 240.901 190.358Z" fill="var(--accent)"/>
      </svg>
    </button>
  );
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

// ---------- Font switcher ----------
const FONT_FAMILY: Record<FontId, string> = {
  mono: "'Geist Mono', ui-monospace, Menlo, monospace",
  serif: "'Newsreader', Georgia, serif",
  sans: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  dys: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
  apfel: "'Apfel Grotezk', -apple-system, BlinkMacSystemFont, sans-serif",
  outfit: "'Outfit', ui-sans-serif, system-ui, sans-serif",
};

const SITE_VERSIONS = [
  { label: '2026 (current)', url: '' },
  { label: '2024', url: 'https://2024.paine.design' },
  { label: '2022', url: 'https://2022.paine.design' },
];

const RESOURCES = [
  { label: 'Design Resources', slug: 'design-resources-list' },
  { label: 'Outdoor Resources', slug: 'outdoors-resources-list' },
];

const FONT_LABELS: Record<FontId, string> = {
  mono: 'Geist Mono',
  serif: 'Newsreader',
  sans: 'DM Sans',
  dys: 'OpenDyslexic',
  apfel: 'Apfel Grotezk',
  outfit: 'Outfit',
};

interface ChromeProps {
  theme: string;
  setTheme: (t: string) => void;
  font: FontId;
  setFont: (f: FontId) => void;
  onTimeTravel: (url: string) => void;
  onOpenResource: (slug: string) => void;
  themeLocked: boolean;
  fontLocked: boolean;
  onToggleThemeLock: () => void;
  onToggleFontLock: () => void;
}

// Shared motion vocabulary — matches bloom's spring feel
const SPRING = { type: 'spring', visualDuration: 0.3, bounce: 0.15 } as const;
const OVERLAY_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
} as const;
const DIALOG_POP = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
  transition: SPRING,
} as const;

// ---------- Liquid-glass chrome (bloom morphing menus) ----------
// The glass surface; bloom's Container animates its own (subtle) shadow.
const GLASS: CSSProperties = {
  background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
  backdropFilter: 'blur(18px) saturate(1.6)',
  border: '1px solid color-mix(in srgb, var(--fg) 16%, transparent)',
};

function GlassPanelItem({ onClick, href, external, children, active, closeOnSelect = true }: { onClick?: () => void; href?: string; external?: boolean; children: React.ReactNode; active?: boolean; closeOnSelect?: boolean }) {
  const select = () => {
    if (href) {
      if (external) window.open(href, '_blank', 'noopener');
      else window.location.href = href;
    }
    onClick?.();
  };
  return (
    <Menu.Item
      onSelect={select}
      closeOnSelect={closeOnSelect}
      className="hp-glass-item"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', textAlign: 'left', padding: '11px 16px', fontSize: 14, borderRadius: 10,
        color: active ? 'var(--fg)' : 'var(--fg-dim)', background: active ? 'var(--tile)' : 'transparent',
      }}
    >
      {children}
    </Menu.Item>
  );
}

/** One floating glass button that blooms into its panel. */
function GlassBloom({ pos, anchor, label, trigger, children }: {
  pos: CSSProperties; anchor: 'start' | 'end'; label: string; trigger: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', zIndex: 140, ...pos }}>
      <Menu.Root direction="top" anchor={anchor}>
        <Menu.Container buttonSize={46} menuWidth={300} menuRadius={18} style={{ ...GLASS, color: 'var(--fg)' }}>
          <Menu.Trigger style={{ color: 'var(--fg)', fontSize: 16 }}>
            <span role="img" aria-label={label} title={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {trigger}
            </span>
          </Menu.Trigger>
          <Menu.Content style={{ padding: 6, maxHeight: '62vh', overflowY: 'auto' }}>
            {children}
          </Menu.Content>
        </Menu.Container>
      </Menu.Root>
    </div>
  );
}

function GlassSectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-faint)', padding: '10px 16px 4px' }}>{children}</div>;
}

function GlassLockButton({ locked, toggle }: { locked: boolean; toggle: () => void }) {
  return (
    <button onClick={toggle} title={locked ? 'locked (tap to unlock)' : 'randomizes on reload (tap to lock)'} style={{ color: locked ? 'var(--accent)' : 'var(--fg-faint)', padding: 6, lineHeight: 1 }}>
      {locked ? <Lock size={15} weight="fill" /> : <LockOpen size={15} weight="fill" />}
    </button>
  );
}

function FontPanelBody({ font, setFont, fontLocked, onToggleFontLock }: Pick<ChromeProps, 'font' | 'setFont' | 'fontLocked' | 'onToggleFontLock'>) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
        <GlassSectionLabel>font</GlassSectionLabel>
        <GlassLockButton locked={fontLocked} toggle={onToggleFontLock} />
      </div>
      {FONT_IDS.map((f) => (
        <GlassPanelItem key={f} active={f === font} closeOnSelect={false} onClick={() => setFont(f)}>
          <span style={{ fontFamily: FONT_FAMILY[f] }}>{FONT_LABELS[f]}</span>
        </GlassPanelItem>
      ))}
    </>
  );
}

function ThemePanelBody({ theme, setTheme, themeLocked, onToggleThemeLock }: Pick<ChromeProps, 'theme' | 'setTheme' | 'themeLocked' | 'onToggleThemeLock'>) {
  const [search, setSearch] = useState('');
  const filtered = search ? MT_THEMES.filter((t) => t.name.replace(/_/g, ' ').includes(search.toLowerCase())) : MT_THEMES;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
        <GlassSectionLabel>theme</GlassSectionLabel>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {THEME_PAIRS[theme] && (
            <button onClick={() => setTheme(THEME_PAIRS[theme])} title="light/dark" style={{ color: 'var(--fg-dim)', padding: 6, lineHeight: 1 }}>
              {THEME_PAIRS[theme].includes('dark') ? <Moon size={15} weight="fill" /> : <Sun size={15} weight="fill" />}
            </button>
          )}
          <button onClick={() => { const r = MT_THEMES[Math.floor(Math.random() * MT_THEMES.length)]; setTheme(r.name); }} title="random theme" style={{ color: 'var(--fg-dim)', padding: 6, lineHeight: 1 }}>
            <Shuffle size={15} weight="fill" />
          </button>
          <GlassLockButton locked={themeLocked} toggle={onToggleThemeLock} />
        </div>
      </div>
      <div style={{ padding: '0 10px 6px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search themes..."
          style={{ width: '100%', background: 'var(--tile)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--fg)', outline: 'none' }}
        />
      </div>
      {filtered.map((t) => (
        <GlassPanelItem key={t.name} active={t.name === theme} closeOnSelect={false} onClick={() => setTheme(t.name)}>
          <span>{t.name.replace(/_/g, ' ')}</span>
          <span style={{ display: 'inline-flex', gap: 3 }}>
            <span style={dot(t.bg)} />
            <span style={dot(t.fg)} />
            <span style={dot(t.accent)} />
          </span>
        </GlassPanelItem>
      ))}
    </>
  );
}

function MobileChrome({ theme, setTheme, font, setFont, onTimeTravel, onOpenResource, themeLocked, fontLocked, onToggleThemeLock, onToggleFontLock }: ChromeProps) {
  const mobileBottom = 'calc(16px + env(safe-area-inset-bottom))';
  return (
    <>
      <GlassBloom pos={{ left: 16, bottom: mobileBottom }} anchor="start" label="menu" trigger={<span style={{ letterSpacing: '0.08em' }}>···</span>}>
        <GlassPanelItem href="https://github.com/hudbud/hudbud" external>github <span style={{ opacity: 0.45, fontSize: 11 }}>↗</span></GlassPanelItem>
        <GlassPanelItem href="/graph">space</GlassPanelItem>
        <GlassSectionLabel>resources</GlassSectionLabel>
        {RESOURCES.map((r) => (
          <GlassPanelItem key={r.slug} onClick={() => onOpenResource(r.slug)}>{r.label}</GlassPanelItem>
        ))}
        <GlassSectionLabel>time machine</GlassSectionLabel>
        {SITE_VERSIONS.map((v) => (
          <GlassPanelItem key={v.label} active={!v.url} onClick={() => { if (v.url) onTimeTravel(v.url); }}>{v.label}</GlassPanelItem>
        ))}
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '10px 16px 8px' }}>© 2026 Hudson Paine</div>
      </GlassBloom>

      <GlassBloom pos={{ right: 16, bottom: mobileBottom }} anchor="end" label="appearance settings" trigger={<span style={{ fontFamily: FONT_FAMILY[font], fontWeight: 500 }}>Aa</span>}>
        <FontPanelBody font={font} setFont={setFont} fontLocked={fontLocked} onToggleFontLock={onToggleFontLock} />
        <ThemePanelBody theme={theme} setTheme={setTheme} themeLocked={themeLocked} onToggleThemeLock={onToggleThemeLock} />
      </GlassBloom>
    </>
  );
}

// ---------- Desktop chrome: same glass buttons, one bloom menu per panel ----------
function DesktopChrome({ theme, setTheme, font, setFont, onTimeTravel, onOpenResource, themeLocked, fontLocked, onToggleThemeLock, onToggleFontLock }: ChromeProps) {
  return (
    <>
      {/* left: time machine, resources, links */}
      <GlassBloom pos={{ left: 16, bottom: 16 }} anchor="start" label="time machine" trigger={<ClockCounterClockwise size={18} weight="fill" />}>
        <GlassSectionLabel>time machine</GlassSectionLabel>
        {SITE_VERSIONS.map((v) => (
          <GlassPanelItem key={v.label} active={!v.url} onClick={() => { if (v.url) onTimeTravel(v.url); }}>{v.label}</GlassPanelItem>
        ))}
      </GlassBloom>
      <GlassBloom pos={{ left: 70, bottom: 16 }} anchor="start" label="resources" trigger={<BookOpen size={18} weight="fill" />}>
        <GlassSectionLabel>resources</GlassSectionLabel>
        {RESOURCES.map((r) => (
          <GlassPanelItem key={r.slug} onClick={() => onOpenResource(r.slug)}>{r.label}</GlassPanelItem>
        ))}
      </GlassBloom>
      <GlassBloom pos={{ left: 124, bottom: 16 }} anchor="start" label="links" trigger={<LinkSimple size={18} weight="bold" />}>
        <GlassSectionLabel>links</GlassSectionLabel>
        <GlassPanelItem href="https://github.com/hudbud/hudbud" external>github <span style={{ opacity: 0.45, fontSize: 11 }}>↗</span></GlassPanelItem>
        <GlassPanelItem href="/graph">space</GlassPanelItem>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '10px 16px 8px' }}>© 2026 Hudson Paine</div>
      </GlassBloom>

      {/* right: font, theme */}
      <GlassBloom pos={{ right: 70, bottom: 16 }} anchor="end" label="font" trigger={<span style={{ fontFamily: FONT_FAMILY[font], fontWeight: 500 }}>Aa</span>}>
        <FontPanelBody font={font} setFont={setFont} fontLocked={fontLocked} onToggleFontLock={onToggleFontLock} />
      </GlassBloom>
      <GlassBloom pos={{ right: 16, bottom: 16 }} anchor="end" label="theme" trigger={<Palette size={18} weight="fill" />}>
        <ThemePanelBody theme={theme} setTheme={setTheme} themeLocked={themeLocked} onToggleThemeLock={onToggleThemeLock} />
      </GlassBloom>
    </>
  );
}

// ---------- Tab button ----------
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        color: active ? 'var(--bg)' : hovered ? 'var(--bg)' : 'var(--fg-dim)',
        background: active ? 'var(--fg)' : hovered ? 'var(--fg-faint)' : 'transparent',
        borderRadius: 2,
        transition: 'all 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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

function WorkSection({ work, activePost, setActivePost }: { work: Post[]; activePost: Post | null; setActivePost: (p: Post | null) => void }) {
  return (
    <div>
      {work.length > 0 && (
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)', marginBottom: 12 }}>Case Studies</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {work.map((p) => {
              const isActive = activePost && activePost.title === p.title;
              return (
                <button
                  key={p.title}
                  onClick={() => setActivePost(isActive ? null : { ...p, tag: 'work' } as Post)}
                  style={{ display: 'block', padding: '12px 12px', textAlign: 'left', color: isActive ? 'var(--accent)' : 'var(--fg)', background: isActive ? 'var(--tile)' : 'transparent', borderRadius: 2, transition: 'all 0.15s' }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = isActive ? 'var(--accent)' : 'var(--fg)'; }}
                >
                  <div style={{ fontSize: 13 }}>{p.title}</div>
                  {(p.agency || p.roles) && (
                    <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 3 }}>
                      {p.agency && <span>{p.agency}</span>}
                      {p.agency && p.roles && <span> · </span>}
                      {p.roles && <span>{p.roles.split(',')[0]}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ marginTop: work.length > 0 ? 28 : 0, borderTop: work.length > 0 ? '1px solid var(--rule)' : 'none', paddingTop: work.length > 0 ? 20 : 0 }}>
        <ResumeList />
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<IdeaStatus, string> = {
  new: 'new!',
  'in-development': 'in development',
  idea: 'idea',
  dormant: 'dormant',
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
              <span style={{ fontSize: 13 }}>{idea.title}{external && isLinkable && <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.5 }}>↗</span>}</span>
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

const ARCHIVE_CATEGORIES: Record<string, string> = {
  bigsur: 'photo', 'travel-video': 'film', 'film-1': 'film', naps: 'motion', 'video_art': 'motion', vjloops: 'motion',
  doodles: 'illustration', doodles2: 'illustration', everything: 'illustration',
  d4design: 'branding', locoll: 'branding', painepacificgallery: 'branding', 'thrill-1': 'branding', 'zeroidea-1': 'branding',
  'buildform': 'branding', 'country-gentlemen': 'branding', 'papercut-films': 'branding', 'savasana-sound': 'branding', tunein: 'branding', 'ugly-boys': 'branding',
  thevault: 'product', 'playlight-1': 'product', 'trew-gear': 'product', pellowski: 'motion',
};
const ARCHIVE_CHIPS = ['all', 'branding', 'motion', 'illustration', 'product', 'film', 'photo'] as const;

function ArchiveList({ posts, activePost, setActivePost }: { posts: Post[]; activePost: Post | null; setActivePost: (p: Post | null) => void }) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? posts : posts.filter((p) => ARCHIVE_CATEGORIES[p.slug || ''] === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {ARCHIVE_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setFilter(chip)}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 12,
              background: filter === chip ? 'var(--accent)' : 'var(--tile)',
              color: filter === chip ? 'var(--bg)' : 'var(--fg-dim)',
              transition: 'all 0.15s',
            }}
          >
            {chip}
          </button>
        ))}
      </div>
      {filtered.map((p) => {
        const isActive = activePost && activePost.title === p.title;
        return (
          <button
            key={p.title}
            onClick={() => setActivePost(isActive ? null : { ...p, tag: 'archive' } as Post)}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, padding: '10px 12px', textAlign: 'left', alignItems: 'baseline', color: isActive ? 'var(--accent)' : 'var(--fg)', background: isActive ? 'var(--tile)' : 'transparent', borderRadius: 2, transition: 'all 0.15s' }}
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

function PostList({ posts, activePost, setActivePost }: { posts: Post[]; activePost: Post | null; setActivePost: (p: Post | null) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {posts.map((p) => {
        const isActive = activePost && activePost.title === p.title;
        return (
          <button
            key={p.title}
            onClick={() => setActivePost(isActive ? null : { ...p, tag: 'thoughts' } as Post)}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, padding: '10px 12px', textAlign: 'left', alignItems: 'baseline', color: isActive ? 'var(--accent)' : 'var(--fg)', background: isActive ? 'var(--tile)' : 'transparent', borderRadius: 2, transition: 'all 0.15s' }}
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
            style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 16, padding: '10px 12px', textAlign: 'left', alignItems: 'center', color: isActive ? 'var(--accent)' : 'var(--fg)', background: isActive ? 'var(--tile)' : 'transparent', borderRadius: 2, transition: 'all 0.15s' }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--fg)'; }}
          >
            {p.feature_image ? (
              <img src={p.feature_image} alt="" loading="lazy" style={{ width: 96, height: 58, objectFit: 'cover', borderRadius: 2 }} />
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
    <motion.div
      {...OVERLAY_FADE}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 40px', overflowY: 'auto' }}
    >
      <motion.div
        {...DIALOG_POP}
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
        {content.image && <img src={content.image} alt="" loading="lazy" style={{ width: '100%', borderRadius: 2, marginBottom: 18 }} />}
        {content.body.split('\n\n').map((para, i) => (
          <p key={i} className="prose" style={{ color: 'var(--fg)', marginBottom: 14, fontSize: 13, lineHeight: 1.65 }}>{para}</p>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ---------- Bio link (hover preview on desktop, click opens modal) ----------
function BioLink({ label, modalId, onOpenModal }: { label: string; modalId: string; onOpenModal?: (id: string) => void }) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!show || !popoverRef.current || !containerRef.current) return;
    const pop = popoverRef.current;
    pop.style.left = '50%';
    pop.style.right = '';
    pop.style.transform = 'translateX(-50%)';
    const rect = pop.getBoundingClientRect();
    let el: HTMLElement | null = containerRef.current.parentElement;
    while (el && getComputedStyle(el).overflowY !== 'auto' && getComputedStyle(el).overflowY !== 'scroll') {
      el = el.parentElement;
    }
    const rightEdge = el ? el.getBoundingClientRect().right : window.innerWidth;
    const leftEdge = el ? el.getBoundingClientRect().left : 0;
    if (rect.left < leftEdge + 8) {
      pop.style.left = '0';
      pop.style.transform = 'translateX(0)';
    } else if (rect.right > rightEdge - 8) {
      pop.style.left = 'auto';
      pop.style.right = '0';
      pop.style.transform = 'translateX(0)';
    }
  }, [show]);

  return (
    <span ref={containerRef} style={{ position: 'relative', display: 'inline' }} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        onClick={handleClick}
        style={{ color: 'var(--accent)', textDecoration: 'none', cursor: 'pointer' }}
      >
        {label}
      </button>
      <AnimatePresence>
        {show && content && (
          // The positioning effect above manually adjusts left/transform to
          // dodge viewport edges, so motion may only animate opacity here —
          // animating x/y would make framer-motion fight over `transform`.
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', width: 320, background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 4, padding: '16px 18px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 150 }}
          >
            {content.image && <img src={content.image} alt="" loading="lazy" style={{ width: '100%', borderRadius: 2, marginBottom: 10 }} />}
            <p style={{ color: 'var(--fg)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{content.preview}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// ---------- Left column ----------
function LeftColumn({ activeTab, setActiveTab, activePost, setActivePost, onOpenProject, onOpenBioModal, onHome, life, work, archive }: {
  activeTab: TabId | null;
  setActiveTab: (t: TabId) => void;
  activePost: Post | null;
  setActivePost: (p: Post | null) => void;
  onOpenProject: (id: string) => void;
  onOpenBioModal: (id: string) => void;
  onHome: () => void;
  life: Post[];
  work: Post[];
  archive: Post[];
}) {
  const [showMore, setShowMore] = useState(false);
  // Apple-style type scale: one big, tight display line; supporting lines a
  // step down with relaxed leading. (500 is the heaviest weight all five
  // site fonts actually ship, so it stays true rather than synthesizing.)
  const [leadDisplay, ...leadRest] = BIO_LEAD.split('\n');
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '56px 40px 80px 48px', minHeight: '100%', justifyContent: 'center' }}>
      <div>
        <div style={{ marginBottom: 14 }}>
          <HudMark size={46} onClick={onHome} />
        </div>
        <h1 style={{ margin: 0, marginBottom: 16, fontSize: 13, fontWeight: 400 }}>
          <button onClick={onHome} style={{ color: 'var(--accent)', letterSpacing: '0.01em', padding: 0, textAlign: 'left' }}>Hudson Paine</button>
        </h1>
        <p style={{ color: 'var(--fg)', margin: 0, marginBottom: 10, fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.12 }}>{leadDisplay}</p>
        {leadRest.length > 0 && (
          <p style={{ color: 'var(--fg)', opacity: 0.85, margin: 0, marginBottom: 10, whiteSpace: 'pre-line', fontSize: 17, letterSpacing: '-0.011em', lineHeight: 1.5 }}>{leadRest.join('\n')}</p>
        )}
        <button
          onClick={() => setShowMore(v => !v)}
          style={{ fontSize: 12, color: 'var(--fg-dim)', padding: 0, transition: 'color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; }}
        >
          {showMore ? 'less' : 'more'}
        </button>
        {showMore && (
          <div style={{ marginTop: 12 }}>
            <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>{BIO_BODY}</p>
            <p className="prose" style={{ color: 'var(--fg)', margin: 0, marginBottom: 12 }}>
              {BIO_BODY_2}{' '}
              <BioLink label="maker, tinkerer, and serial hobbyist" modalId="hobbyist" onOpenModal={onOpenBioModal} />,{' '}
              I <BioLink label="love computers" modalId="computers" onOpenModal={onOpenBioModal} />,{' '}
              I'm an <BioLink label="outdoorsman" modalId="outdoorsman" onOpenModal={onOpenBioModal} />,{' '}
              and I have strong opinions on just about everything.
            </p>
            <p className="prose" style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>
              <BioLink label={`${BIO_ORIGIN} →`} modalId="origin" onOpenModal={onOpenBioModal} />
            </p>
          </div>
        )}
      </div>

      {activeTab === null ? (
        <motion.div key="landing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTab(tag)}
                style={{ fontSize: 13, color: 'var(--fg-dim)', border: '1px solid var(--fg-dim)', borderRadius: 999, padding: '7px 16px', letterSpacing: '-0.005em', transition: 'color 0.15s, border-color 0.15s, background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.borderColor = 'var(--fg)'; e.currentTarget.style.background = 'var(--tile)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--fg-dim)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {tag}
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, fontSize: 12, alignItems: 'center' }}>
            {ALL_TABS.map((tag) => (
              <TabButton key={tag} active={activeTab === tag} onClick={() => setActiveTab(tag)}>
                {tag}
              </TabButton>
            ))}
          </div>

          {activeTab === 'work' && <WorkSection work={work} activePost={activePost} setActivePost={setActivePost} />}
          {activeTab === 'ideas' && <IdeasList onOpenProject={onOpenProject} />}
          {activeTab === 'life' && <LifeList posts={life} activePost={activePost} setActivePost={setActivePost} />}
          {activeTab === 'archive' && <ArchiveList posts={archive} activePost={activePost} setActivePost={setActivePost} />}
        </motion.div>
      )}
    </div>
    </div>
  );
}

// ---------- Image gallery (MVP default right panel) ----------
function ImageGallery({ images, onImageClick }: { images: GalleryImage[]; onImageClick?: (slug: string) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const velocityRef = useRef(0);
  const targetVelRef = useRef(0.2);
  const rafRef = useRef<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const k = targetVelRef.current === 0 ? 0.03 : 0.06;
      velocityRef.current += (targetVelRef.current - velocityRef.current) * k;
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
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: number | null = null;
    const pause = () => {
      targetVelRef.current = 0;
      if (timer !== null) clearTimeout(timer);
      timer = window.setTimeout(() => { if (hoveredIdx === null) targetVelRef.current = 0.2; }, 2000);
    };
    el.addEventListener('wheel', pause, { passive: true });
    el.addEventListener('touchmove', pause, { passive: true });
    return () => { el.removeEventListener('wheel', pause); el.removeEventListener('touchmove', pause); if (timer !== null) clearTimeout(timer); };
  }, [hoveredIdx]);

  if (!images.length) return null;

  return (
    <div style={{ position: 'relative', height: '100%', opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {images.map((img, i) => {
            const isHovered = hoveredIdx === i;
            const anyHovered = hoveredIdx !== null;
            return (
              <div
                key={i}
                onMouseEnter={() => { setHoveredIdx(i); targetVelRef.current = 0; }}
                onMouseLeave={() => { setHoveredIdx(null); targetVelRef.current = 0.2; }}
                onClick={() => onImageClick?.(img.slug)}
                style={{
                  aspectRatio: '4 / 3',
                  borderRadius: 2,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  opacity: anyHovered ? (isHovered ? 1 : 0.4) : 0.88,
                  boxShadow: isHovered ? '0 0 16px rgba(255,255,255,0.12)' : 'none',
                  transition: 'opacity 0.4s ease, box-shadow 0.3s ease',
                  background: 'var(--tile)',
                }}
              >
                <img src={img.src} alt="" loading="lazy" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            );
          })}
        </div>
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
    <motion.div
      {...OVERLAY_FADE}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 18 }}
    >

      <button
        onClick={onClose}
        style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '6px 14px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 2 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
      >
        [ close × ]
      </button>

      <motion.div
        {...DIALOG_POP}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 'min(78vw, 1100px)', maxHeight: '70vh', aspectRatio: '4 / 3', background: tile.color, overflow: 'hidden', borderRadius: 2, boxShadow: '0 20px 80px rgba(0,0,0,0.5)' }}
      >
        <TileMedia tile={tile} />
        {!tile.image && (
          <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            fig. 01 / placeholder
          </div>
        )}
      </motion.div>

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
    </motion.div>
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
          style={{ background: 'var(--accent)', color: 'var(--bg)', borderRadius: 2, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}
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
          style={{ background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 2, padding: '3px 6px', fontSize: 11, color: 'var(--fg)' }}
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
            <button onClick={reset} style={{ background: 'var(--accent)', color: 'var(--bg)', borderRadius: 2, padding: '6px 14px', fontSize: 11, fontWeight: 600 }}>restart</button>
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
              <button onClick={reset} style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 10px' }}>restart</button>
              <button onClick={onClose} style={{ fontSize: 11, color: 'var(--fg-dim)', padding: '4px 8px' }}>done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Post panel (replaces lightbox) ----------
function Lightbox({ images, index, onClose, onChange }: { images: string[]; index: number; onClose: () => void; onChange: (i: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onChange((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onChange]);

  return (
    <motion.div
      {...OVERLAY_FADE}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.img
        key={index}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
        src={images[index]}
        alt=""
        onClick={(e) => { e.stopPropagation(); onChange((index + 1) % images.length); }}
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', cursor: images.length > 1 ? 'pointer' : 'default', borderRadius: 2 }}
      />
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onChange((index - 1 + images.length) % images.length); }}
            style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: '#fff', opacity: 0.7, background: 'none', cursor: 'pointer' }}
          >‹</button>
          <button
            onClick={(e) => { e.stopPropagation(); onChange((index + 1) % images.length); }}
            style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', fontSize: 28, color: '#fff', opacity: 0.7, background: 'none', cursor: 'pointer' }}
          >›</button>
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </motion.div>
  );
}

function groupConsecutiveImages(html: string): string {
  const imgParagraph = /^<p>\s*<img\s[^>]*>\s*<\/p>$/;
  const lines = html.split('\n');
  const result: string[] = [];
  let group: string[] = [];

  const flushGroup = () => {
    if (group.length >= 2) {
      result.push(`<div style="display:grid;grid-template-columns:repeat(${Math.min(group.length, 3)},1fr);gap:8px;margin:12px 0">${group.join('')}</div>`);
    } else if (group.length === 1) {
      result.push(group[0]);
    }
    group = [];
  };

  for (const line of lines) {
    if (imgParagraph.test(line.trim())) {
      const img = line.trim().replace(/^<p>\s*/, '').replace(/\s*<\/p>$/, '');
      group.push(img.replace('<img ', '<img style="width:100%;height:auto;border-radius:2px;display:block" '));
    } else {
      flushGroup();
      result.push(line);
    }
  }
  flushGroup();
  return result.join('\n');
}

const postHtmlCache = new Map<string, string>();

function PostPanel({ post, onClose }: { post: Post; onClose: () => void }) {
  const [showSpritz, setShowSpritz] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [fetchedHtml, setFetchedHtml] = useState<string | null>(
    post.html ?? (post.slug ? postHtmlCache.get(post.slug) ?? null : null)
  );
  const proseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cached = post.slug ? postHtmlCache.get(post.slug) ?? null : null;
    setFetchedHtml(post.html ?? cached);
    if (post.html || !post.slug || cached) return;
    const slug = post.slug;
    let cancelled = false;
    fetch(`/posts/${slug}.json`)
      .then((r) => r.json())
      .then((data: { html: string }) => {
        if (cancelled) return;
        postHtmlCache.set(slug, data.html);
        setFetchedHtml(data.html);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [post.slug, post.html]);

  // Only close the panel on Escape when the image lightbox isn't the one
  // that should be handling it (Lightbox has its own Escape handler).
  useEffect(() => {
    if (lightboxIdx !== null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, lightboxIdx]);

  const isLoadingHtml = !post.html && !fetchedHtml;
  const postHtml = fetchedHtml ?? post.html ?? `<p>${post.excerpt}</p>`;
  const wordCount = postHtml.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / 230));

  const postImages = useMemo(() => {
    const srcs: string[] = [];
    if (post.feature_image) srcs.push(post.feature_image);
    const matches = postHtml.matchAll(/<img[^>]+src="([^"]+)"/g);
    for (const m of matches) {
      if (!srcs.includes(m[1])) srcs.push(m[1]);
    }
    return srcs;
  }, [postHtml, post.feature_image]);

  useEffect(() => {
    const el = proseRef.current;
    if (!el) return;
    const handleClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement).closest('img');
      if (!img) return;
      const src = img.getAttribute('src') || '';
      const idx = postImages.indexOf(src);
      if (idx >= 0) setLightboxIdx(idx);
    };
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [postImages]);

  const isLife = post.tag === 'life';
  const isWork = post.tag === 'work' || post.tag === 'archive';
  const hasImage = (isLife && (post.img || post.feature_image)) || (isWork && post.feature_image);

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
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showSpritz ? 'hide speed reader' : <><Lightning size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />speed read</>}
        </button>
        <button
          onClick={() => { setShowTyping(!showTyping); setShowSpritz(false); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showTyping ? 'hide typing test' : <><Keyboard size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />typing test</>}
        </button>
      </div>

      {showSpritz && <SpritzReader html={postHtml} onClose={() => setShowSpritz(false)} />}
      {showTyping && <TypingTest html={postHtml} onClose={() => setShowTyping(false)} />}

      {hasImage && (
        <div style={{ marginBottom: 24 }}>
          {post.feature_image ? (
            <img
              src={post.feature_image}
              alt=""
              loading="lazy"
              style={{ width: '100%', borderRadius: 2, cursor: 'pointer' }}
              onClick={() => setLightboxIdx(0)}
            />
          ) : (
            <LifeImage color={post.img || '#3a434e'} seed={post.title.length} height={260} />
          )}
        </div>
      )}

      {isLoadingHtml ? (
        <div style={{ color: 'var(--fg-dim)', fontSize: 13, padding: '8px 0 20px' }}>loading…</div>
      ) : (
        <div ref={proseRef} className="prose" style={{ color: 'var(--fg)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: groupConsecutiveImages(postHtml) }} />
      )}
      <style>{`.prose img { cursor: pointer; }`}</style>

      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox images={postImages} index={lightboxIdx} onClose={() => setLightboxIdx(null)} onChange={setLightboxIdx} />
        )}
      </AnimatePresence>


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
            style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 10px' }}
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
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showSpritz ? 'hide speed reader' : <><Lightning size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />speed read</>}
        </button>
        <button
          onClick={() => { setShowTyping(!showTyping); setShowSpritz(false); }}
          style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showTyping ? 'hide typing test' : <><Keyboard size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />typing test</>}
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
interface GalleryImage {
  src: string;
  slug: string;
}

interface PortfolioProps {
  thoughts?: Post[];
  life?: Post[];
  archive?: Post[];
  work?: Post[];
  resources?: Post[];
  galleryImages?: GalleryImage[];
}

export default function Portfolio({ thoughts: thoughtsProp, life: lifeProp, archive: archiveProp, work: workProp, resources: resourcesProp }: PortfolioProps) {
  const thoughts = thoughtsProp ?? [];
  const life = lifeProp ?? [];
  const archive = archiveProp ?? [];
  const work = workProp ?? [];
  const resources = resourcesProp ?? [];

  // isMobile starts false to match the server render; the mount effect below
  // corrects it on the client before paint-sensitive layout settles.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [theme, setThemeRaw] = useState(getInitialTheme);
  const [font, setFontRaw] = useState<FontId>(getInitialFont);
  const [themeLocked, setThemeLocked] = useState(false);
  const [fontLocked, setFontLocked] = useState(false);
  const [activeTab, setActiveTabRaw] = useState<TabId | null>(null);
  const handleTabClick = (t: TabId) => setActiveTabRaw(prev => prev === t ? null : t);

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
  const [activePost, setActivePostRaw] = useState<Post | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  // Reconcile deferred, client-only state: the theme/font the inline head
  // script already painted, lock flags, and any ?tab=/?post= deep link.
  useEffect(() => {
    const initial = readHpInitial();
    if (initial) {
      setThemeRaw(initial.theme);
      setFontRaw(initial.font);
    }
    setThemeLocked(!!localStorage.getItem('hp-lock-theme'));
    setFontLocked(!!localStorage.getItem('hp-lock-font'));

    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && (ALL_TABS as string[]).includes(tab)) setActiveTabRaw(tab as TabId);

    const postSlug = params.get('post');
    if (postSlug) {
      const allPosts = [...work, ...thoughts, ...life, ...archive, ...resources];
      const found = allPosts.find((p) => p.slug === postSlug);
      if (found) {
        setActivePostRaw(found);
        if (found.tag && (ALL_TABS as string[]).includes(found.tag)) setActiveTabRaw(found.tag as TabId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [bioModal, setBioModal] = useState<string | null>(null);
  const [timeTravelUrl, setTimeTravelUrl] = useState<string | null>(null);

  const setActiveTile = (t: Tile | null) => { setActiveTileRaw(t); setActivePostRaw(null); };
  const setActivePost = (p: Post | null) => { setActivePostRaw(p); setActiveTileRaw(null); setActiveProject(null); };
  const openProject = (id: string) => { setActiveProject(id); setActivePostRaw(null); setActiveTileRaw(null); };
  const closeRightPanel = () => { setActivePostRaw(null); setActiveProject(null); };

  useEffect(() => {
    const mt = MT_THEMES.find((t) => t.name === theme) || MT_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--bg', mt.bg);
    root.style.setProperty('--bg-inner', mt.bgInner);
    root.style.setProperty('--fg', mt.fg);
    root.style.setProperty('--fg-dim', mt.dim);
    root.style.setProperty('--fg-faint', `color-mix(in srgb, ${mt.fg} 30%, ${mt.bg})`);
    root.style.setProperty('--rule', `color-mix(in srgb, ${mt.fg} 14%, ${mt.bg})`);
    root.style.setProperty('--tile', `color-mix(in srgb, ${mt.fg} 8%, ${mt.bg})`);
    if (mt.name === 'rainbow_trail') {
      root.style.removeProperty('--accent');
      document.body.classList.add('rainbow-trail');
    } else {
      root.style.setProperty('--accent', mt.accent);
      document.body.classList.remove('rainbow-trail');
    }
  }, [theme]);

  useEffect(() => {
    document.body.dataset.font = font;
  }, [font]);

  const panelOpen = !!(activePost || activeProject);
  const rightContent = activePost
    ? <PostPanel post={activePost} onClose={closeRightPanel} />
    : activeProject
      ? <ProjectPanel projectId={activeProject} onClose={closeRightPanel} />
      : null;

  return (
    <div style={{ height: '100dvh', padding: isMobile ? 0 : 20, background: 'var(--bg)', overflow: 'hidden' }}>
      <div
        style={{
          height: isMobile ? '100dvh' : 'calc(100dvh - 40px)',
          background: 'var(--bg-inner)',
          borderRadius: isMobile ? 0 : 4,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left spacer: centers left column when panel closed (desktop only) */}
        {!isMobile && (
          <div style={{ flexGrow: panelOpen ? 0 : 1, flexShrink: 0, flexBasis: 0, transition: 'flex-grow 0.42s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        )}

        {/* Left column */}
        {(!isMobile || !panelOpen) && (
          <div style={{
            flexShrink: 0,
            width: isMobile ? '100%' : (panelOpen ? '50%' : 640),
            transition: isMobile ? undefined : 'width 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
            overflowY: 'auto',
            height: '100%',
          }}>
            <LeftColumn
              activeTab={activeTab}
              setActiveTab={handleTabClick}
              activePost={activePost}
              setActivePost={setActivePost}
              onOpenProject={openProject}
              onOpenBioModal={setBioModal}
              onHome={() => { setActiveTabRaw(null); closeRightPanel(); }}
              life={life}
              work={work}
              archive={archive}
            />
          </div>
        )}

        {/* Right panel */}
        {(!isMobile || panelOpen) && (
          <div style={{
            flexShrink: 0,
            width: isMobile ? '100%' : (panelOpen ? '50%' : 0),
            overflow: 'hidden',
            height: '100%',
            opacity: panelOpen ? 1 : 0,
            transform: (!isMobile && !panelOpen) ? 'translateX(16px)' : undefined,
            transition: isMobile ? undefined : 'width 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease 0.1s, transform 0.35s ease 0.08s',
          }}>
            {rightContent}
          </div>
        )}

        {/* Right spacer: mirrors left spacer (desktop only) */}
        {!isMobile && (
          <div style={{ flexGrow: panelOpen ? 0 : 1, flexShrink: 0, flexBasis: 0, transition: 'flex-grow 0.42s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        )}
      </div>

      {(() => {
        const chromeProps: ChromeProps = {
          theme, setTheme, font, setFont,
          onTimeTravel: setTimeTravelUrl,
          onOpenResource: (slug: string) => { const p = resources.find(r => r.slug === slug); if (p) setActivePost(p); },
          themeLocked, fontLocked,
          onToggleThemeLock: toggleThemeLock, onToggleFontLock: toggleFontLock,
        };
        return isMobile ? <MobileChrome {...chromeProps} /> : <DesktopChrome {...chromeProps} />;
      })()}

      <AnimatePresence>
        {activeTile && <TileLightbox key="tile" tile={activeTile} onClose={() => setActiveTile(null)} />}
        {bioModal && <BioModal key="bio" modalId={bioModal} onClose={() => setBioModal(null)} />}
      </AnimatePresence>
      {timeTravelUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>viewing: {timeTravelUrl}</span>
            <button
              onClick={() => setTimeTravelUrl(null)}
              style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 12px' }}
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
