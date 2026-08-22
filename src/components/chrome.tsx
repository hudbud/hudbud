// Shared liquid-glass chrome: the floating bloom buttons and the font/theme
// panel bodies. Portfolio.tsx composes these into its full Mobile/Desktop
// chrome; AppearanceChrome.tsx mounts just the font + theme pair on
// standalone pages (e.g. /halftone).
import { useState, type CSSProperties } from 'react';
import { Menu } from 'bloom-menu';
import { MT_THEMES, THEME_PAIRS } from '../data/themes';
import { Lock, LockOpen, Shuffle, Moon, Sun } from '@phosphor-icons/react';

export type FontId = 'mono' | 'serif' | 'sans' | 'dys' | 'apfel' | 'outfit';

export const FONT_IDS: FontId[] = ['mono', 'serif', 'sans', 'dys', 'apfel', 'outfit'];

export const FONT_FAMILY: Record<FontId, string> = {
  mono: "'Geist Mono', ui-monospace, Menlo, monospace",
  serif: "'Newsreader', Georgia, serif",
  sans: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  dys: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
  apfel: "'Apfel Grotezk', -apple-system, BlinkMacSystemFont, sans-serif",
  outfit: "'Outfit', ui-sans-serif, system-ui, sans-serif",
};

export const FONT_LABELS: Record<FontId, string> = {
  mono: 'Geist Mono',
  serif: 'Newsreader',
  sans: 'DM Sans',
  dys: 'OpenDyslexic',
  apfel: 'Apfel Grotezk',
  outfit: 'Outfit',
};

export function dot(bg: string): CSSProperties {
  return { width: 8, height: 8, borderRadius: '50%', background: bg, display: 'inline-block' };
}

/** Apply a theme's CSS variables (and the rainbow-trail body class) — the
    same painting the inline head script does before hydration. */
export function applyThemeVars(themeName: string) {
  const mt = MT_THEMES.find((t) => t.name === themeName) || MT_THEMES[0];
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
}

// The glass surface; bloom's Container animates its own (subtle) shadow.
export const GLASS: CSSProperties = {
  background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
  backdropFilter: 'blur(18px) saturate(1.6)',
  border: '1px solid color-mix(in srgb, var(--fg) 16%, transparent)',
};

export function GlassPanelItem({ onClick, href, external, children, active, closeOnSelect = true }: { onClick?: () => void; href?: string; external?: boolean; children: React.ReactNode; active?: boolean; closeOnSelect?: boolean }) {
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
export function GlassBloom({ pos, anchor, label, trigger, children }: {
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

export function GlassSectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-faint)', padding: '10px 16px 4px' }}>{children}</div>;
}

export function GlassLockButton({ locked, toggle }: { locked: boolean; toggle: () => void }) {
  return (
    <button onClick={toggle} title={locked ? 'locked (tap to unlock)' : 'randomizes on reload (tap to lock)'} style={{ color: locked ? 'var(--accent)' : 'var(--fg-faint)', padding: 6, lineHeight: 1 }}>
      {locked ? <Lock size={15} weight="fill" /> : <LockOpen size={15} weight="fill" />}
    </button>
  );
}

export interface FontPanelProps {
  font: FontId;
  setFont: (f: FontId) => void;
  fontLocked: boolean;
  onToggleFontLock: () => void;
}

export interface ThemePanelProps {
  theme: string;
  setTheme: (t: string) => void;
  themeLocked: boolean;
  onToggleThemeLock: () => void;
}

export function FontPanelBody({ font, setFont, fontLocked, onToggleFontLock }: FontPanelProps) {
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

export function ThemePanelBody({ theme, setTheme, themeLocked, onToggleThemeLock }: ThemePanelProps) {
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
