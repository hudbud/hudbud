import { useEffect, useState, type CSSProperties } from 'react';

const VARS = ['--bg', '--bg-inner', '--fg', '--fg-dim', '--fg-faint', '--accent', '--rule', '--tile'] as const;

export interface SiteTheme {
  bg: string;
  bgInner: string;
  fg: string;
  dim: string;
  faint: string;
  accent: string;
  rule: string;
  tile: string;
  light: boolean;
}

function readVar(name: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.documentElement.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function luminance(rgb: string): number {
  const m = rgb.match(/[\d.]+/g);
  if (!m || m.length < 3) return 0.5;
  const [r, g, b] = m.slice(0, 3).map((n) => {
    const v = Number(n);
    return (v > 1 ? v / 255 : v);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readTheme(): SiteTheme {
  const [bg, bgInner, fg, dim, faint, accent, rule, tile] = VARS.map(readVar);
  return { bg, bgInner, fg, dim, faint, accent, rule, tile, light: luminance(bgInner) > 0.55 };
}

export function useSiteTheme(): SiteTheme {
  const [theme, setTheme] = useState<SiteTheme | null>(null);
  useEffect(() => {
    const update = () => setTheme(readTheme());
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-font'] });
    return () => obs.disconnect();
  }, []);
  return theme ?? {
    bg: '#323437', bgInner: '#2c2e31', fg: '#d1d0c5', dim: '#646669',
    faint: '#4a4b4e', accent: '#e2b714', rule: '#3d4043', tile: '#3a3c3f', light: false,
  };
}

export function ToolEmpty({ title, hint, onChoose, error }: {
  title: string;
  hint: string;
  onChoose: () => void;
  error?: string | null;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--fg)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.02em' }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--fg-dim)' }}>{hint}</div>
        <button
          onClick={onChoose}
          style={{
            marginTop: 14,
            fontSize: 13,
            color: 'var(--accent)',
            background: 'none',
            padding: '4px 2px',
          }}
        >
          Choose file
        </button>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg-dim)' }}>{error}</div>}
      </div>
    </div>
  );
}

export const toolBtn: CSSProperties = {
  background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
  color: 'var(--fg)',
  border: '1px solid var(--rule)',
  borderRadius: 8,
  padding: '5px 10px',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  backdropFilter: 'blur(12px)',
};

export const toolStatus: CSSProperties = {
  position: 'absolute',
  left: 16,
  bottom: 36,
  background: 'color-mix(in srgb, var(--bg) 82%, transparent)',
  color: 'var(--fg-dim)',
  fontSize: 12,
  padding: '6px 10px',
  borderRadius: 8,
  display: 'flex',
  gap: 14,
  pointerEvents: 'none',
  maxWidth: 'calc(100% - 280px)',
  flexWrap: 'wrap',
  backdropFilter: 'blur(12px)',
};
