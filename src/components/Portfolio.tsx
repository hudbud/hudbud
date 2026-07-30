import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Menu } from 'bloom-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { BIO_LEAD, BIO_BODY, BIO_BODY_2, BIO_ORIGIN, MODAL_CONTENT } from '../data/bio';
import { RESUME, LINKS, SELECT_CLIENTS } from '../data/resume';
import { IDEAS, type Idea, type IdeaStatus } from '../data/ideas';
import { MT_THEMES, THEME_PAIRS } from '../data/themes';
import { type Post } from '../data/posts';
import { groupImagesIntoGrid } from '../lib/imageGrid';
import { KEYBOARD_HTML } from '../data/keyboard';
import FreezerMartini from './FreezerMartini';
import { Lock, LockOpen, Shuffle, Moon, Sun, CaretUp, Lightning, Keyboard, Sparkle, ClockCounterClockwise, BookOpen, LinkSimple, Palette, Copy, Check, ListDashes, Image as ImageIcon } from '@phosphor-icons/react';

type Filter = 'all' | 'work' | 'life';
type FontId = 'mono' | 'serif' | 'sans' | 'dys' | 'apfel' | 'outfit';

const FILTERS: Filter[] = ['all', 'work', 'life'];
// A post's facing direction: life -> Life, anything else (work, archive,
// resources, thoughts) -> Work — archive/resources/ideas sink into the same
// bucket as active client work rather than getting their own filter.
const WORK_TAGS = ['work', 'archive', 'resources', 'thoughts'];
function matchesFilter(p: Post, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'life') return p.tags.includes('life');
  return p.tags.some((t) => WORK_TAGS.includes(t));
}

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

// ---------- Filter pill ----------
function FilterPill({ active, highlight, onClick, onMouseEnter, onMouseLeave, children }: {
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  // Highlight (sweep) uses the same subtle treatment as hover, since `all`
  // stays active for the whole sweep and needs its own distinguishable cue.
  const lit = hovered || (highlight && !active);
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 13,
        color: active ? 'var(--bg)' : lit ? 'var(--fg)' : 'var(--fg-dim)',
        background: active ? 'var(--fg)' : highlight && !active ? 'var(--fg-faint)' : hovered ? 'var(--tile)' : 'transparent',
        border: `1px solid ${active || lit ? 'var(--fg)' : 'var(--fg-dim)'}`,
        borderRadius: 999,
        padding: '7px 16px',
        letterSpacing: '-0.005em',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={() => { setHovered(true); onMouseEnter?.(); }}
      onMouseLeave={() => { setHovered(false); onMouseLeave?.(); }}
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
  dormant: 'dormant',
  stale: 'stale',
  retired: 'retired',
};

// ---------- Unified feed ----------
// Every entry — post or idea — renders through this one row, in one flat
// chronological list. A row's only variance is: does it have an image
// (shown when viewMode is 'roomy'), and what its click does.
const CATEGORY_CHIPS = ['all', 'portfolio', 'branding', 'motion', 'illustration', 'product', 'film', 'photo'] as const;
type ViewMode = 'compact' | 'roomy';

interface Row {
  key: string;
  title: string;
  date: string;
  dateValue: number;
  image?: string;
  meta?: string;
  isActive: boolean;
  onClick: (() => void) | null;
}

function formatIdeaDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}.${d.getFullYear()}`;
}

function ideaClickAction(idea: Idea, openProject: (id: string) => void): (() => void) | null {
  if (idea.internal && idea.href.startsWith('#')) return () => openProject(idea.href.slice(1));
  if (!idea.internal && idea.href !== '#') return () => window.open(idea.href, '_blank', 'noopener');
  return null;
}

function buildRows({ feed, filter, workCategory, activePost, activeProject, setActivePost, openProject }: {
  feed: Post[];
  filter: Filter;
  workCategory: string;
  activePost: Post | null;
  activeProject: string | null;
  setActivePost: (p: Post | null) => void;
  openProject: (id: string) => void;
}): Row[] {
  const postRows: Row[] = feed
    // Resources live only in the "..." chrome menu, not the chronological list.
    .filter((p) => !p.tags.includes('resources'))
    .filter((p) => matchesFilter(p, filter) && (filter !== 'work' || workCategory === 'all' || p.category === workCategory))
    .map((p) => ({
      key: p.slug ?? p.title,
      title: p.title,
      date: p.date,
      dateValue: p.dateValue,
      image: p.feature_image,
      meta: p.agency || p.roles ? [p.agency, p.roles?.split(',')[0]].filter(Boolean).join(' · ') : p.category,
      isActive: !!(activePost && activePost.title === p.title),
      onClick: () => setActivePost(activePost && activePost.title === p.title ? null : p),
    }));

  // Ideas map to the Work bucket; a specific category chip has nothing to
  // match against, so they only show under "all".
  const ideaRows: Row[] = (filter === 'life' || (filter === 'work' && workCategory !== 'all'))
    ? []
    : IDEAS.map((idea) => {
        const slug = idea.internal && idea.href.startsWith('#') ? idea.href.slice(1) : null;
        return {
          key: idea.title,
          title: idea.title,
          date: formatIdeaDate(idea.date),
          dateValue: +new Date(idea.date),
          meta: idea.statusNote || STATUS_LABEL[idea.status],
          isActive: slug ? activeProject === slug : false,
          onClick: ideaClickAction(idea, openProject),
        };
      });

  return [...postRows, ...ideaRows].sort((a, b) => b.dateValue - a.dateValue);
}

function FeedRow({ row, index, showImage }: { row: Row; index: number; showImage: boolean }) {
  const clickable = !!row.onClick;
  const [hovered, setHovered] = useState(false);
  const lit = row.isActive || (hovered && clickable);
  return (
    <button
      onClick={row.onClick ?? undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: showImage ? '96px 1fr auto' : '1fr auto',
        gap: 16,
        padding: '10px 12px',
        textAlign: 'left',
        alignItems: 'center',
        color: lit ? 'var(--accent)' : 'var(--fg)',
        background: lit ? 'var(--tile)' : 'transparent',
        borderRadius: 2,
        opacity: clickable ? 1 : 0.6,
        cursor: clickable ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showImage && (
        row.image ? (
          <img src={row.image} alt="" loading="lazy" style={{ width: 96, height: 58, objectFit: 'cover', borderRadius: 2 }} />
        ) : (
          <LifeImage color="#3a434e" seed={index} height={58} />
        )
      )}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13 }}>{row.title}</span>
        {row.meta && <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{row.meta}</span>}
      </span>
      <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>{row.date}</span>
    </button>
  );
}

const VIEW_MODE_ICON: Record<ViewMode, typeof ListDashes> = { compact: ListDashes, roomy: ImageIcon };
const VIEW_MODE_LABEL: Record<ViewMode, string> = { compact: 'compact (text only)', roomy: 'roomy (with thumbnails)' };

function ViewModeToggle({ mode, setMode }: { mode: ViewMode; setMode: (m: ViewMode) => void }) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--tile)', borderRadius: 8 }}>
      {(['compact', 'roomy'] as const).map((m) => {
        const Icon = VIEW_MODE_ICON[m];
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-label={VIEW_MODE_LABEL[m]}
            title={VIEW_MODE_LABEL[m]}
            style={{
              display: 'flex', padding: '6px 8px', borderRadius: 6,
              background: mode === m ? 'var(--bg-inner)' : 'transparent',
              color: mode === m ? 'var(--fg)' : 'var(--fg-dim)',
              transition: 'all 0.15s',
            }}
          >
            <Icon size={14} weight={mode === m ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}

function Feed({ feed, filter, workCategory, setWorkCategory, activePost, activeProject, setActivePost, openProject, viewMode }: {
  feed: Post[];
  filter: Filter;
  workCategory: string;
  setWorkCategory: (c: string) => void;
  activePost: Post | null;
  activeProject: string | null;
  setActivePost: (p: Post | null) => void;
  openProject: (id: string) => void;
  viewMode: ViewMode;
}) {
  const rows = useMemo(
    () => buildRows({ feed, filter, workCategory, activePost, activeProject, setActivePost, openProject }),
    [feed, filter, workCategory, activePost, activeProject, setActivePost, openProject]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {filter === 'work' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setWorkCategory(chip)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 12,
                background: workCategory === chip ? 'var(--accent)' : 'var(--tile)',
                color: workCategory === chip ? 'var(--bg)' : 'var(--fg-dim)',
                transition: 'all 0.15s',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <FeedRow key={row.key} row={row} index={i} showImage={viewMode === 'roomy'} />
      ))}
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
function LeftColumn({ filter, setFilter, workCategory, setWorkCategory, activePost, activeProject, setActivePost, onOpenProject, onOpenBioModal, onHome, feed }: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  workCategory: string;
  setWorkCategory: (c: string) => void;
  activePost: Post | null;
  activeProject: string | null;
  setActivePost: (p: Post | null) => void;
  onOpenProject: (id: string) => void;
  onOpenBioModal: (id: string) => void;
  onHome: () => void;
  feed: Post[];
}) {
  const [showMore, setShowMore] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  // Apple-style type scale: one big, tight display line; supporting lines a
  // step down with relaxed leading. (500 is the heaviest weight all five
  // site fonts actually ship, so it stays true rather than synthesizing.)
  const [leadDisplay, ...leadRest] = BIO_LEAD.split('\n');
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '56px 40px 80px 48px', minHeight: '100%', justifyContent: 'flex-start' }}>
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
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)' }}>
              <ResumeList />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <FilterPill
              key={f}
              active={filter === f}
              onClick={() => setFilter(filter === f ? 'all' : f)}
            >
              {f}
            </FilterPill>
          ))}
        </div>
        <ViewModeToggle mode={viewMode} setMode={setViewMode} />
      </div>

      <motion.div key={filter} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
        <Feed
          feed={feed}
          filter={filter}
          workCategory={workCategory}
          setWorkCategory={setWorkCategory}
          activePost={activePost}
          activeProject={activeProject}
          setActivePost={setActivePost}
          openProject={onOpenProject}
          viewMode={viewMode}
        />
      </motion.div>
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

const postHtmlCache = new Map<string, string>();

// Mobile-only escape hatch at the top of a full-screen panel; the sticky
// "✕ Close" pill at the bottom remains the primary close affordance.
function PanelBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--fg-dim)', padding: 0, marginBottom: 18 }}
    >
      ← back
    </button>
  );
}

function PostPanel({ post, onClose, isMobile = false }: { post: Post; onClose: () => void; isMobile?: boolean }) {
  const [showSpritz, setShowSpritz] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    if (!post.slug) return;
    const url = `${window.location.origin}/posts/${post.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
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

  // Autoplaying <video> tags in post content: browsers pause them once they
  // scroll out of view and never resume automatically, so drive play/pause
  // off actual visibility instead of relying on the autoplay attribute alone.
  useEffect(() => {
    const el = proseRef.current;
    if (!el) return;
    const videos = Array.from(el.querySelectorAll('video'));
    if (!videos.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }
    }, { threshold: 0.25 });
    videos.forEach((v) => observer.observe(v));
    return () => observer.disconnect();
  }, [postHtml]);

  const isLife = post.tags.includes('life');
  const isWork = post.tags.includes('work') || post.tags.includes('archive');
  const hasImage = (isLife && (post.img || post.feature_image)) || (isWork && post.feature_image);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isMobile ? '28px 24px 100px' : '56px 56px 100px 48px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {isMobile && <PanelBackButton onClick={onClose} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ color: 'var(--fg-faint)', fontSize: 11 }}>
          [{post.tags.join(', ')}] · {post.date}
        </div>
        {post.slug && (
          <button
            onClick={copyLink}
            aria-label="copy link to post"
            style={{ display: 'flex', alignItems: 'center', color: copied ? 'var(--accent)' : 'var(--fg-faint)' }}
            onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--fg-dim)'; }}
            onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--fg-faint)'; }}
          >
            {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
          </button>
        )}
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
        <div ref={proseRef} className="prose" style={{ color: 'var(--fg)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: groupImagesIntoGrid(postHtml) }} />
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

      <div style={{ position: 'sticky', bottom: 24, marginTop: 'auto', paddingTop: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
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

function ProjectPanel({ projectId, onClose, isMobile = false }: { projectId: string; onClose: () => void; isMobile?: boolean }) {
  const [showSpritz, setShowSpritz] = useState(false);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (projectId === 'freezer-martini') {
    return (
      <div style={{ height: '100%', overflowY: 'auto', padding: '32px 24px 100px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {isMobile && <PanelBackButton onClick={onClose} />}
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
        <div style={{ position: 'sticky', bottom: 24, marginTop: 'auto', paddingTop: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
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
    <div style={{ height: '100%', overflowY: 'auto', padding: isMobile ? '28px 24px 100px' : '56px 48px 100px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {isMobile && <PanelBackButton onClick={onClose} />}
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

      <div style={{ position: 'sticky', bottom: 24, marginTop: 'auto', paddingTop: 24, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
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

// ---------- FrameFooter ----------
// Lives in the outer border padding around the site (desktop only).
function FrameFooter() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const date = `${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${now.getFullYear()}`;

  return (
    <div
      className="hp-frame-footer"
      style={{
        position: 'absolute',
        right: 20,
        bottom: 3,
        fontSize: 10,
        letterSpacing: 0.2,
        color: 'var(--fg-faint)',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      &copy;&nbsp; {time} {date} &nbsp;|&nbsp; this website subject to change
    </div>
  );
}

// ---------- App ----------
interface PortfolioProps {
  feed?: Post[];
}

export default function Portfolio({ feed: feedProp }: PortfolioProps) {
  const feed = feedProp ?? [];

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
  const [filter, setFilterRaw] = useState<Filter>('all');
  const [workCategory, setWorkCategory] = useState('all');
  const setFilter = (f: Filter) => { setFilterRaw(f); setWorkCategory('all'); };

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

  const [activePost, setActivePostRaw] = useState<Post | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  // Reconcile deferred, client-only state: the theme/font the inline head
  // script already painted, lock flags, and any ?filter=/?cat=/?post= deep link.
  useEffect(() => {
    const initial = readHpInitial();
    if (initial) {
      setThemeRaw(initial.theme);
      setFontRaw(initial.font);
    }
    setThemeLocked(!!localStorage.getItem('hp-lock-theme'));
    setFontLocked(!!localStorage.getItem('hp-lock-font'));

    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam && (FILTERS as string[]).includes(filterParam)) setFilterRaw(filterParam as Filter);
    const catParam = params.get('cat');
    if (catParam) setWorkCategory(catParam);

    const postSlug = params.get('post');
    if (postSlug) {
      const found = feed.find((p) => p.slug === postSlug);
      if (found) {
        setActivePostRaw(found);
        if (found.tags.includes('life')) setFilterRaw('life');
        else if (found.tags.some((t) => WORK_TAGS.includes(t))) setFilterRaw('work');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [bioModal, setBioModal] = useState<string | null>(null);
  const [timeTravelUrl, setTimeTravelUrl] = useState<string | null>(null);

  const setActivePost = (p: Post | null) => { setActivePostRaw(p); setActiveProject(null); };
  const openProject = (id: string) => { setActiveProject(id); setActivePostRaw(null); };
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
    ? <PostPanel post={activePost} onClose={closeRightPanel} isMobile={isMobile} />
    : activeProject
      ? <ProjectPanel projectId={activeProject} onClose={closeRightPanel} isMobile={isMobile} />
      : null;

  return (
    <div style={{ height: '100dvh', padding: isMobile ? 0 : 20, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
      {!isMobile && <FrameFooter />}
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
              filter={filter}
              setFilter={setFilter}
              workCategory={workCategory}
              setWorkCategory={setWorkCategory}
              activePost={activePost}
              activeProject={activeProject}
              setActivePost={setActivePost}
              onOpenProject={openProject}
              onOpenBioModal={setBioModal}
              onHome={() => { setFilter('all'); closeRightPanel(); }}
              feed={feed}
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
          onOpenResource: (slug: string) => { const p = feed.find(r => r.slug === slug); if (p) setActivePost(p); },
          themeLocked, fontLocked,
          onToggleThemeLock: toggleThemeLock, onToggleFontLock: toggleFontLock,
        };
        return isMobile ? <MobileChrome {...chromeProps} /> : <DesktopChrome {...chromeProps} />;
      })()}

      <AnimatePresence>
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
