// Standalone font, shuffle, and theme floating buttons for pages that don't render the
// full Portfolio island (e.g. /halftone). Reads the same localStorage keys and
// window.__hpInitial handoff as Portfolio, so choices carry across pages.
import { useEffect, useState } from 'react';
import {
  GlassBloom, FontPanelBody, ThemePanelBody, ShuffleButton, applyThemeVars,
  randomLook, FONT_FAMILY, type FontId,
} from './chrome';
import { Palette } from '@phosphor-icons/react';

const DEFAULT_THEME = 'hudbud_light';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readHpInitial();
    if (initial) {
      setThemeRaw(initial.theme);
      setFontRaw(initial.font);
    }
    setMounted(true);
    // The ⌘K palette can roll the theme too; keep state in step with it.
    const onTheme = (e: Event) => setThemeRaw((e as CustomEvent<string>).detail);
    window.addEventListener('hp:theme', onTheme);
    return () => window.removeEventListener('hp:theme', onTheme);
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
  const shuffle = () => {
    const next = randomLook(theme, font, document.documentElement.classList.contains('hp-a11y'));
    setTheme(next.theme);
    setFont(next.font);
  };

  // Sit inside the project frame (20px border) with the same gap as the homepage pair.
  const edge = 36;
  return (
    <>
      <GlassBloom pos={{ right: edge + 108, bottom: edge }} anchor="end" label="font" trigger={<span style={{ fontFamily: FONT_FAMILY[font], fontWeight: 500 }}>Aa</span>}>
        <FontPanelBody font={font} setFont={setFont} />
      </GlassBloom>
      <ShuffleButton pos={{ right: edge + 54, bottom: edge }} onClick={shuffle} />
      <GlassBloom pos={{ right: edge, bottom: edge }} anchor="end" label="theme" trigger={<Palette size={18} weight="fill" />}>
        <ThemePanelBody theme={theme} setTheme={setTheme} />
      </GlassBloom>
    </>
  );
}
