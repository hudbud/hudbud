// Standalone font + theme floating buttons for pages that don't render the
// full Portfolio island (e.g. /halftone). Reads the same localStorage keys and
// window.__hpInitial handoff as Portfolio, so choices carry across pages.
import { useEffect, useState } from 'react';
import {
  GlassBloom, FontPanelBody, ThemePanelBody, applyThemeVars,
  FONT_FAMILY, type FontId,
} from './chrome';
import { Palette } from '@phosphor-icons/react';

const DEFAULT_THEME = 'earthsong';
const DEFAULT_FONT: FontId = 'apfel';

interface HpInitial {
  theme: string;
  font: FontId;
}

function readHpInitial(): HpInitial | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __hpInitial?: HpInitial }).__hpInitial ?? null;
}

export default function AppearanceChrome() {
  const [theme, setThemeRaw] = useState(DEFAULT_THEME);
  const [font, setFontRaw] = useState<FontId>(DEFAULT_FONT);
  const [themeLocked, setThemeLocked] = useState(false);
  const [fontLocked, setFontLocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readHpInitial();
    if (initial) {
      setThemeRaw(initial.theme);
      setFontRaw(initial.font);
    }
    setThemeLocked(!!localStorage.getItem('hp-lock-theme'));
    setFontLocked(!!localStorage.getItem('hp-lock-font'));
    setMounted(true);
  }, []);

  // The inline head script already painted the initial theme/font; only
  // repaint on user changes after mount.
  useEffect(() => {
    if (!mounted) return;
    applyThemeVars(theme);
  }, [theme, mounted]);
  useEffect(() => {
    if (!mounted) return;
    document.body.dataset.font = font;
  }, [font, mounted]);

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

  return (
    <>
      <GlassBloom pos={{ right: 70, bottom: 'calc(16px + env(safe-area-inset-bottom))' }} anchor="end" label="font" trigger={<span style={{ fontFamily: FONT_FAMILY[font], fontWeight: 500 }}>Aa</span>}>
        <FontPanelBody font={font} setFont={setFont} fontLocked={fontLocked} onToggleFontLock={toggleFontLock} />
      </GlassBloom>
      <GlassBloom pos={{ right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))' }} anchor="end" label="theme" trigger={<Palette size={18} weight="fill" />}>
        <ThemePanelBody theme={theme} setTheme={setTheme} themeLocked={themeLocked} onToggleThemeLock={toggleThemeLock} />
      </GlassBloom>
    </>
  );
}
