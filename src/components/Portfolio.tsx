import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { BIO_LEAD, BIO_BODY, BIO_BODY_2, BIO_ORIGIN, MODAL_CONTENT } from '../data/bio';
import { RESUME, LINKS, SELECT_CLIENTS } from '../data/resume';
import { IDEAS, type Idea, type IdeaStatus } from '../data/ideas';
import { MT_THEMES, SAFE_THEME_NAMES } from '../data/themes';
import { type Post } from '../data/posts';
import { groupImagesIntoGrid, stripMetaParagraphs, addFigCaptions, isExcerptRedundant } from '../lib/imageGrid';
import { GlassBloom, GlassPanelItem, GlassSectionLabel, FontPanelBody, ThemePanelBody, FONT_FAMILY, GLASS, applyThemeVars, type FontId } from './chrome';
import { KEYBOARD_HTML } from '../data/keyboard';
import FreezerMartini from './FreezerMartini';
import ThoughtsModal, { ThoughtsButton } from './ThoughtsModal';
import { Shuffle, CaretUp, Lightning, Keyboard, Sparkle, ClockCounterClockwise, BookOpen, LinkSimple, Palette, Copy, Check, ListDashes, Image as ImageIcon, MagnifyingGlass, PersonArmsSpread } from '@phosphor-icons/react';

// The feed is grouped into labeled sections rather than one flat filtered
// list. projects = projects/thoughts posts + IDEAS (with in-development items
// split into an expandable sub-list); photos = life posts; work = every
// work/archive post in one bucket, newest first — curation happens by dating
// the relevant items to the top, not by sub-taxonomy.
type SectionKey = 'projects' | 'photos' | 'work';

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
  a11y?: boolean;
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
  const fills = {
    faint: 'var(--fg-faint)',
    dim: 'var(--fg-dim)',
    fg: 'var(--fg)',
    accentMix: 'color-mix(in srgb, var(--accent) 50%, var(--fg))',
    accent: 'var(--accent)',
  };

  return (
    <button onClick={onClick} aria-label="home" style={{ display: 'block', padding: 0, cursor: onClick ? 'pointer' : 'default', lineHeight: 0 }}>
      <svg width={size} height={size} viewBox="0 0 330 329" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M203.833 290.257L126.128 290.242L119.865 283.999L210.104 284.006L203.833 290.257Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M191.322 302.728L138.66 302.729L132.395 296.484L197.579 296.491L191.322 302.728Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.794 315.217L151.188 315.219L144.924 308.974L185.051 308.979L178.794 315.217Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M164.992 328.975L157.453 321.46L172.526 321.465L164.992 328.975Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M113.13 177.859L51.2288 177.843L64.4456 190.991L45.5201 209.857L-1.88858e-05 164.479L45.4981 119.124L64.4263 137.993L51.2179 151.16L85.8397 151.164C91.5678 117.699 118.013 91.3369 151.569 85.6408L151.564 51.1284L138.356 64.2946L119.428 45.4259L164.94 0.0566261L210.526 45.3858L191.6 64.2519L178.389 51.0819L178.393 85.595C211.958 91.3071 238.414 117.68 244.144 151.14L278.712 151.147L265.502 137.978L284.427 119.112L329.929 164.556L284.431 209.911L265.503 191.042L278.705 177.899L256.937 177.893L256.929 177.885L216.79 177.868C217.914 173.586 218.518 169.097 218.527 164.467C218.518 135.182 194.334 111.074 164.956 111.064C135.563 111.067 111.388 135.166 111.399 164.452C111.406 169.069 112.003 173.567 113.13 177.859Z" fill={fills.dim}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.362 277.76L151.603 277.758L151.606 271.51L178.365 271.512L178.362 277.76Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.355 265.278L151.61 265.262L151.6 259.027L178.359 259.029L178.355 265.278Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M213.96 227.823L116.013 227.796C113.499 225.854 111.096 223.771 108.822 221.561L221.142 221.575C218.881 223.789 216.486 225.871 213.96 227.823Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M148.757 215.326L103.083 215.307C101.421 213.311 99.8655 211.223 98.4078 209.062L135.706 209.076C139.718 211.717 144.107 213.83 148.757 215.326Z" fill={fills.fg}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M190.673 240.308L139.325 240.291C134.462 238.639 129.804 236.54 125.4 234.046L204.58 234.061C200.19 236.558 195.541 238.655 190.673 240.308Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M127.879 202.832L94.5861 202.822C93.4634 200.797 92.4287 198.719 91.4989 196.576L122.317 196.58C124.009 198.804 125.86 200.904 127.879 202.832Z" fill={fills.accentMix}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M178.363 252.779L151.604 252.778L151.607 246.53L178.367 246.531L178.363 252.779Z" fill={fills.faint}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M118.212 190.334L89.0445 190.336C88.3474 188.284 87.716 186.211 87.1793 184.092L115.212 184.091C116.071 186.248 117.079 188.328 118.212 190.334Z" fill={fills.accent}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M226.884 215.331L181.14 215.327C185.798 213.833 190.181 211.724 194.201 209.084L231.551 209.093C230.103 211.242 228.538 213.331 226.884 215.331Z" fill={fills.fg}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M235.375 202.84L202.035 202.839C204.044 200.91 205.915 198.816 207.606 196.598L238.454 196.604C237.521 198.728 236.49 200.811 235.375 202.84Z" fill={fills.accentMix}/>
        <path fillRule="evenodd" clipRule="evenodd" d="M240.901 190.358L211.723 190.35C212.842 188.354 213.845 186.27 214.716 184.112L242.76 184.122C242.233 186.227 241.603 188.315 240.901 190.358Z" fill={fills.accent}/>
      </svg>
    </button>
  );
}

// ---------- LifeImage ----------
function LifeImage({ color, seed = 0, height = 140 }: { color: string; seed?: number; height?: number | string }) {
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

// Past sites are gone from their original hosts (framer/squarespace/adobe
// portfolio subscriptions lapsed), so the time machine replays Wayback Machine
// snapshots instead. The `if_` timestamp modifier serves the raw archived page
// without the Wayback toolbar, and replay pages send no frame-blocking
// headers, so they load cleanly in the overlay iframe.
interface SiteVersion {
  label: string;
  url: string;
  /** Human-viewable wayback page (with toolbar) for the "open ↗" escape hatch. */
  pageUrl?: string;
}

function wayback(timestamp: string, original: string): Pick<SiteVersion, 'url' | 'pageUrl'> {
  return {
    url: `https://web.archive.org/web/${timestamp}if_/${original}`,
    pageUrl: `https://web.archive.org/web/${timestamp}/${original}`,
  };
}

const SITE_VERSIONS: SiteVersion[] = [
  { label: '2026 (current)', url: '' },
  { label: '2023', ...wayback('20230907005627', 'https://www.paine.design/') },
  { label: '2022', ...wayback('20220405235635', 'https://www.paine.design/') },
  { label: '2020', ...wayback('20201101080101', 'https://www.paine.design/') },
];

const RESOURCES = [
  { label: 'Design Resources', slug: 'design-resources-list' },
  { label: 'Outdoor Resources', slug: 'outdoors-resources-list' },
];

interface ChromeProps {
  theme: string;
  setTheme: (t: string) => void;
  font: FontId;
  setFont: (f: FontId) => void;
  onTimeTravel: (v: SiteVersion) => void;
  onOpenResource: (slug: string) => void;
  onOpenThoughts: () => void;
  themeLocked: boolean;
  fontLocked: boolean;
  onToggleThemeLock: () => void;
  onToggleFontLock: () => void;
  a11y: boolean;
  onToggleA11y: () => void;
}

// Glass icon button matching ThoughtsButton — accessibility toggle. Active
// state shows in the accent color.
function A11yButton({ pos, active, onClick }: { pos: React.CSSProperties; active: boolean; onClick: () => void }) {
  return (
    <div style={{ position: 'fixed', zIndex: 140, ...pos }}>
      <button
        onClick={onClick}
        title={active ? 'accessibility mode on — reduced motion, high-contrast themes' : 'accessibility mode — reduce motion, high-contrast themes'}
        aria-label="toggle accessibility mode"
        aria-pressed={active}
        style={{
          ...GLASS,
          width: 46, height: 46, borderRadius: 23,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: active ? 'var(--accent)' : 'var(--fg)',
        }}
      >
        <PersonArmsSpread size={18} weight={active ? 'fill' : 'regular'} />
      </button>
    </div>
  );
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

function MobileChrome({ theme, setTheme, font, setFont, onTimeTravel, onOpenResource, onOpenThoughts, themeLocked, fontLocked, onToggleThemeLock, onToggleFontLock, a11y, onToggleA11y }: ChromeProps) {
  const mobileBottom = 'calc(16px + env(safe-area-inset-bottom))';
  return (
    <>
      <GlassBloom pos={{ left: 16, bottom: mobileBottom }} anchor="start" label="menu" trigger={<span style={{ letterSpacing: '0.08em' }}>···</span>}>
        <GlassPanelItem href="https://github.com/hudbud/hudbud" external>github <span style={{ opacity: 0.45, fontSize: 11 }}>↗</span></GlassPanelItem>
        <GlassPanelItem href="https://www.linkedin.com/in/hudsonpaine" external>linkedin <span style={{ opacity: 0.45, fontSize: 11 }}>↗</span></GlassPanelItem>
        <GlassPanelItem href="mailto:hudbud@gmail.com">email</GlassPanelItem>
        <GlassPanelItem href="/about">about</GlassPanelItem>
        <GlassPanelItem href="/graph">space</GlassPanelItem>
        <GlassSectionLabel>resources</GlassSectionLabel>
        {RESOURCES.map((r) => (
          <GlassPanelItem key={r.slug} onClick={() => onOpenResource(r.slug)}>{r.label}</GlassPanelItem>
        ))}
        <GlassSectionLabel>time machine</GlassSectionLabel>
        {SITE_VERSIONS.map((v) => (
          <GlassPanelItem key={v.label} active={!v.url} onClick={() => { if (v.url) onTimeTravel(v); }}>{v.label}</GlassPanelItem>
        ))}
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '10px 16px 8px' }}>© 2026 Hudson Paine</div>
      </GlassBloom>

      <ThoughtsButton pos={{ left: 70, bottom: mobileBottom }} onClick={onOpenThoughts} />

      <A11yButton pos={{ right: 70, bottom: mobileBottom }} active={a11y} onClick={onToggleA11y} />
      <GlassBloom pos={{ right: 16, bottom: mobileBottom }} anchor="end" label="appearance settings" trigger={<span style={{ fontFamily: FONT_FAMILY[font], fontWeight: 500 }}>Aa</span>}>
        <FontPanelBody font={font} setFont={setFont} fontLocked={fontLocked} onToggleFontLock={onToggleFontLock} />
        <ThemePanelBody theme={theme} setTheme={setTheme} themeLocked={themeLocked} onToggleThemeLock={onToggleThemeLock} />
      </GlassBloom>
    </>
  );
}

// ---------- Desktop chrome: same glass buttons, one bloom menu per panel ----------
function DesktopChrome({ theme, setTheme, font, setFont, onTimeTravel, onOpenResource, onOpenThoughts, themeLocked, fontLocked, onToggleThemeLock, onToggleFontLock, a11y, onToggleA11y }: ChromeProps) {
  return (
    <>
      {/* left: time machine, resources, links */}
      <GlassBloom pos={{ left: 16, bottom: 16 }} anchor="start" label="time machine" trigger={<ClockCounterClockwise size={18} weight="fill" />}>
        <GlassSectionLabel>time machine</GlassSectionLabel>
        {SITE_VERSIONS.map((v) => (
          <GlassPanelItem key={v.label} active={!v.url} onClick={() => { if (v.url) onTimeTravel(v); }}>{v.label}</GlassPanelItem>
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
        <GlassPanelItem href="https://www.linkedin.com/in/hudsonpaine" external>linkedin <span style={{ opacity: 0.45, fontSize: 11 }}>↗</span></GlassPanelItem>
        <GlassPanelItem href="mailto:hudbud@gmail.com">email</GlassPanelItem>
        <GlassPanelItem href="/about">about</GlassPanelItem>
        <GlassPanelItem href="/graph">space</GlassPanelItem>
        <div style={{ fontSize: 11, color: 'var(--fg-faint)', padding: '10px 16px 8px' }}>© 2026 Hudson Paine</div>
      </GlassBloom>
      <ThoughtsButton pos={{ left: 178, bottom: 16 }} onClick={onOpenThoughts} />

      {/* right: accessibility, font, theme */}
      <A11yButton pos={{ right: 124, bottom: 16 }} active={a11y} onClick={onToggleA11y} />
      <GlassBloom pos={{ right: 70, bottom: 16 }} anchor="end" label="font" trigger={<span style={{ fontFamily: FONT_FAMILY[font], fontWeight: 500 }}>Aa</span>}>
        <FontPanelBody font={font} setFont={setFont} fontLocked={fontLocked} onToggleFontLock={onToggleFontLock} />
      </GlassBloom>
      <GlassBloom pos={{ right: 16, bottom: 16 }} anchor="end" label="theme" trigger={<Palette size={18} weight="fill" />}>
        <ThemePanelBody theme={theme} setTheme={setTheme} themeLocked={themeLocked} onToggleThemeLock={onToggleThemeLock} />
      </GlassBloom>
    </>
  );
}

// ---------- Editorial rail layout ----------
// Borrowed bones: a five-column grid (1fr / 9rem / 34rem / 9rem / 1fr) with
// sticky mono labels in the left rail and content in a 34rem center column.
// Collapses to a stacked layout when the detail panel halves the column
// (or on mobile), where the label renders above its section instead.
const RAIL_GRID = 'minmax(0, 1fr) 9rem minmax(0, 34rem) 9rem minmax(0, 1fr)';

function RailRow({ label, wide, children, right }: {
  label: React.ReactNode;
  wide: boolean;
  children: React.ReactNode;
  /** Optional right-rail content (sticky, like the label). */
  right?: React.ReactNode;
}) {
  if (!wide) {
    return (
      <section>
        {label && <div style={{ marginBottom: 6 }}>{label}</div>}
        {children}
        {right}
      </section>
    );
  }
  return (
    <section style={{ display: 'grid', gridTemplateColumns: RAIL_GRID, columnGap: 32 }}>
      {label && (
        <div style={{ gridColumn: 2, gridRow: 1, position: 'sticky', top: 24, alignSelf: 'start', justifySelf: 'end', textAlign: 'right', lineHeight: '2rem' }}>
          {label}
        </div>
      )}
      <div style={{ gridColumn: 3, gridRow: 1, minWidth: 0 }}>{children}</div>
      {right && (
        <div style={{ gridColumn: 4, gridRow: 1, position: 'sticky', top: 24, alignSelf: 'start' }}>
          {right}
        </div>
      )}
    </section>
  );
}

// ---------- Lists ----------
function ResumeList() {
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-faint)', marginBottom: 10 }}>select clients</div>
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

// ---------- Sectioned feed ----------
// Every entry — post, idea, or career step — renders through the same row,
// grouped into labeled sections. A row's only variance is: does it have an
// image (shown in the photos grid), and what its click does.
type ViewMode = 'compact' | 'gallery';

interface Row {
  key: string;
  title: string;
  date: string;
  dateValue: number;
  image?: string;
  images?: string[];
  meta?: string;
  /** One-line description shown under the title in projects/work rows. */
  desc?: string;
  /** Handwritten one-liner (frontmatter `summary`) — replaces desc + meta in work rows. */
  summary?: string;
  /** Small mono status tag (ideas only: "in development", "idea", …). */
  tag?: string;
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

interface Section {
  key: SectionKey;
  label: string;
  rows: Row[];
  /** Extra expandable sub-list (projects' in-development items). */
  devRows?: Row[];
}

// "in development" posts have no real date yet — surface them in their own
// expandable sub-list instead of pinning them to the top of projects.
function isInDevelopment(p: Post): boolean {
  return p.date === 'in development';
}

function buildSections({ feed, activePost, activeProject, setActivePost, openProject }: {
  feed: Post[];
  activePost: Post | null;
  activeProject: string | null;
  setActivePost: (p: Post | null) => void;
  openProject: (id: string) => void;
}): Section[] {
  const byDate = (a: Row, b: Row) => b.dateValue - a.dateValue;

  const postRow = (p: Post): Row => ({
    key: p.slug ?? p.title,
    title: p.title,
    date: p.date,
    dateValue: p.dateValue,
    image: p.feature_image,
    images: p.images,
    meta: p.discipline ?? (p.agency || p.roles ? [p.agency, p.roles?.split(',')[0]].filter(Boolean).join(' · ') : p.category),
    desc: p.excerpt || undefined,
    summary: p.summary,
    isActive: !!(activePost && activePost.title === p.title),
    onClick: () => setActivePost(activePost && activePost.title === p.title ? null : p),
  });

  const ideaRow = (idea: Idea): Row => {
    const slug = idea.internal && idea.href.startsWith('#') ? idea.href.slice(1) : null;
    return {
      key: idea.title,
      title: idea.title,
      date: formatIdeaDate(idea.date),
      dateValue: +new Date(idea.date),
      meta: idea.statusNote || STATUS_LABEL[idea.status],
      desc: idea.desc,
      tag: idea.statusNote || STATUS_LABEL[idea.status],
      isActive: slug ? activeProject === slug : false,
      onClick: ideaClickAction(idea, openProject),
    };
  };

  // Resources live only in the "..." chrome menu, not the sections.
  const posts = feed.filter((p) => !p.tags.includes('resources'));
  const projectPosts = posts.filter((p) => p.tags.includes('projects') || p.tags.includes('thoughts'));
  const photoPosts = posts.filter((p) => p.tags.includes('life'));
  const workPosts = posts.filter((p) => p.tags.includes('work') || p.tags.includes('archive'));

  const ideasFor = (section: 'projects' | 'work') =>
    IDEAS.filter((i) => (i.section ?? 'projects') === section).map(ideaRow);

  const projectRows = [...projectPosts.filter((p) => !isInDevelopment(p)).map(postRow), ...ideasFor('projects')].sort(byDate);
  const devRows = projectPosts.filter(isInDevelopment).map(postRow);
  const workRows = [...workPosts.map(postRow), ...ideasFor('work')].sort(byDate);

  return [
    { key: 'projects', label: 'projects', rows: projectRows, devRows },
    { key: 'photos', label: 'photos', rows: photoPosts.map(postRow).sort(byDate) },
    { key: 'work', label: 'work', rows: workRows },
  ].filter((s) => s.rows.length > 0);
}

function FeedRow({ row, isMobile }: { row: Row; isMobile: boolean }) {
  const clickable = !!row.onClick;
  const [hovered, setHovered] = useState(false);
  const lit = row.isActive || (hovered && clickable);
  return (
    <button
      onClick={row.onClick ?? undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: isMobile ? 12 : 16,
        padding: '10px 0',
        textAlign: 'left',
        alignItems: 'baseline',
        color: lit ? 'var(--accent)' : 'var(--fg)',
        opacity: clickable ? 1 : 0.6,
        cursor: clickable ? 'pointer' : 'default',
        width: '100%',
        transition: 'color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 16, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</span>
      <span className="post-spec-cell" style={{ color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{row.date}</span>
    </button>
  );
}

// ---------- Project row (icon tile / title ↗ / description) ----------
function ProjectRow({ row }: { row: Row }) {
  const clickable = !!row.onClick;
  const [hovered, setHovered] = useState(false);
  const lit = row.isActive || (hovered && clickable);
  return (
    <button
      onClick={row.onClick ?? undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '12px 0',
        textAlign: 'left',
        width: '100%',
        cursor: clickable ? 'pointer' : 'default',
        opacity: clickable ? 1 : 0.6,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, minWidth: 36, flexShrink: 0,
        borderRadius: 6, border: '1px solid var(--rule)', background: 'var(--tile)',
        overflow: 'hidden',
        transform: lit ? 'rotate(-4deg) scale(1.06)' : 'none',
        transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        {row.image
          ? <img src={row.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <Sparkle size={15} color="var(--fg-dim)" weight="fill" />}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: lit ? 'var(--accent)' : 'var(--fg)', transition: 'color 0.15s' }}>
            {row.title}
          </span>
          {clickable && (
            <span style={{
              fontSize: 12, color: lit ? 'var(--accent)' : 'var(--fg-dim)',
              display: 'inline-block',
              transform: lit ? 'translate(2px, -2px)' : 'none',
              transition: 'color 0.15s, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
            }}>↗</span>
          )}
          {row.tag && <span className="post-spec-cell" style={{ color: 'var(--fg-faint)' }}>{row.tag}</span>}
        </span>
        {row.desc && (
          <span style={{ display: 'block', marginTop: 2, fontSize: 14, lineHeight: 1.6, color: 'var(--fg-dim)' }}>
            {row.desc}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------- Work row (title / year, discipline, description) ----------
// Hovering cross-fades the whole row into the post's hero image, text
// lifting out as the image fades in.
function WorkRow({ row }: { row: Row }) {
  const clickable = !!row.onClick;
  const [hovered, setHovered] = useState(false);
  const lit = row.isActive || (hovered && clickable);
  const showImage = hovered && clickable && !!row.image;
  // row.date is the post's display string: mm.dd.yyyy when derived from the
  // real date, or a custom dateLabel ("active", "2022 – 2025"). Labels win;
  // plain dates collapse to their year.
  const isPlainDate = /^\d{2}\.\d{2}\.\d{4}$/.test(row.date) && row.dateValue > 0 && row.dateValue <= Date.now();
  const year = isPlainDate ? String(new Date(row.dateValue).getFullYear()) : row.date;
  return (
    <button
      onClick={row.onClick ?? undefined}
      style={{
        position: 'relative',
        display: 'block',
        padding: '12px 0',
        textAlign: 'left',
        width: '100%',
        cursor: clickable ? 'pointer' : 'default',
        opacity: clickable ? 1 : 0.6,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hero image layer — fades in over the row on hover. */}
      {row.image && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: '4px -12px',
            borderRadius: 8,
            overflow: 'hidden',
            opacity: showImage ? 1 : 0,
            transition: 'opacity 0.12s ease-out',
            pointerEvents: 'none',
          }}
        >
          <img
            src={row.image}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: showImage ? 'scale(1)' : 'scale(1.04)', transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </span>
      )}
      <span
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          columnGap: 12,
          alignItems: 'baseline',
          opacity: showImage ? 0 : 1,
          transition: 'opacity 0.1s ease-out',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: lit ? 'var(--accent)' : 'var(--fg)', transition: 'color 0.15s' }}>
          {row.title}
        </span>
        <span className="post-spec-cell" style={{ color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>{year}</span>
        {row.meta && (
          <span style={{ gridColumn: '1 / -1', marginTop: 2, fontSize: 14, lineHeight: 1.6, color: 'var(--fg-faint)' }}>
            {row.meta}
          </span>
        )}
        {(row.summary || row.desc) && (
          <span style={{ gridColumn: '1 / -1', fontSize: 14, lineHeight: 1.6, color: 'var(--fg-dim)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {row.summary ?? row.desc}
          </span>
        )}
      </span>
    </button>
  );
}

// ---------- Grid view (3-wide cards: image / title / date) ----------
function GridCard({ row, index, isMobile }: { row: Row; index: number; isMobile: boolean }) {
  const clickable = !!row.onClick;
  const [hovered, setHovered] = useState(false);
  const lit = row.isActive || (hovered && clickable);
  return (
    <button
      onClick={row.onClick ?? undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        width: '100%',
        textAlign: 'left',
        cursor: clickable ? 'pointer' : 'default',
        opacity: clickable ? 1 : 0.6,
        minWidth: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {row.image ? (
        <img
          src={row.image}
          alt=""
          loading="lazy"
          style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, filter: lit ? 'none' : 'saturate(0.96)', transition: 'filter 0.15s' }}
        />
      ) : (
        <div style={{ aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden' }}>
          <LifeImage color="#3a434e" seed={index} height="100%" />
        </div>
      )}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 14, color: lit ? 'var(--accent)' : 'var(--fg)', transition: 'color 0.15s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'nowrap' : undefined }}>
          {row.title}
        </span>
        <span className="post-spec-cell" style={{ color: 'var(--fg-dim)', fontVariantNumeric: 'tabular-nums' }}>{row.date}</span>
      </span>
    </button>
  );
}

// ---------- Gallery (masonry) ----------
// One randomly-chosen image per post, full-bleed masonry via CSS columns.
// Selection is driven by a seed so shuffle re-picks images AND re-orders
// tiles deterministically between renders.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function GalleryGrid({ rows, seed }: { rows: Row[]; seed: number }) {
  const tiles = useMemo(() => {
    const rand = mulberry32(seed);
    const withImages = rows.filter((r) => r.images && r.images.length > 0);
    const picked = withImages.map((r) => ({
      row: r,
      src: r.images![Math.floor(rand() * r.images!.length)],
    }));
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return picked;
  }, [rows, seed]);

  return (
    <div style={{ columnWidth: 380, columnGap: 12 }}>
      {tiles.map(({ row, src }, i) => (
        <motion.div
          key={`${seed}-${row.key}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: Math.min(i * 0.02, 0.5), ease: [0.22, 1, 0.36, 1] }}
          style={{ breakInside: 'avoid', marginBottom: 12 }}
        >
          <button
            onClick={row.onClick ?? undefined}
            className="hp-gallery-tile"
            style={{ display: 'block', width: '100%', position: 'relative', cursor: row.onClick ? 'pointer' : 'default', borderRadius: 12, overflow: 'hidden' }}
          >
            <img src={src} alt={row.title} loading="lazy" style={{ width: '100%', display: 'block' }} />
            <span className="hp-gallery-caption">
              <span>{row.title}</span>
              <span>{new Date(row.dateValue).getFullYear()}</span>
            </span>
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// Binary toggle: list <-> masonry gallery. Shows the icon of the view you'd
// switch TO, not a segmented control.
function ViewModeToggle({ mode, setMode }: { mode: ViewMode; setMode: (m: ViewMode) => void }) {
  const isGallery = mode === 'gallery';
  const Icon = isGallery ? ListDashes : ImageIcon;
  const label = isGallery ? 'back to list' : 'photo gallery';
  return (
    <button
      onClick={() => setMode(isGallery ? 'compact' : 'gallery')}
      aria-label={label}
      title={label}
      style={{
        display: 'flex', padding: '8px 10px', borderRadius: 8,
        background: 'var(--tile)', color: 'var(--fg-dim)',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
    >
      <Icon size={14} weight="regular" />
    </button>
  );
}

// How many rows a collapsed section shows.
const SECTION_PREVIEW_COUNT = 3;

function SectionToggle({ label, expanded, onClick }: {
  label: string;
  expanded: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      className="post-spec-cell"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
        color: hovered ? 'var(--accent)' : 'var(--fg-dim)',
        transition: 'color 0.15s',
        width: 'fit-content',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CaretUp
        size={10}
        weight="bold"
        style={{ transform: expanded ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}
      />
      {label}
    </button>
  );
}

function SectionHeader({ label, alignEnd }: { label: string; alignEnd?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: alignEnd ? 0 : 6, justifyContent: alignEnd ? 'flex-end' : undefined }}>
      <span style={{ fontSize: 14, color: 'var(--fg-dim)' }}>{label}</span>
    </div>
  );
}

// Case-insensitive match across everything a visitor can see on a row.
function rowMatches(row: Row, q: string): boolean {
  const hay = [row.title, row.desc, row.summary, row.meta, row.tag, row.date].filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every((w) => hay.includes(w));
}

function Feed({ feed, activePost, activeProject, setActivePost, openProject, viewMode, gallerySeed, hasRenderedPosts, isMobile, wide, query }: {
  feed: Post[];
  activePost: Post | null;
  activeProject: string | null;
  setActivePost: (p: Post | null) => void;
  openProject: (id: string) => void;
  viewMode: ViewMode;
  gallerySeed: number;
  hasRenderedPosts: boolean;
  isMobile: boolean;
  wide: boolean;
  query: string;
}) {
  const allSections = useMemo(
    () => buildSections({ feed, activePost, activeProject, setActivePost, openProject }),
    [feed, activePost, activeProject, setActivePost, openProject]
  );

  // While searching: filter every section's rows and drop empty sections.
  const q = query.trim().toLowerCase();
  const sections = useMemo(() => {
    if (!q) return allSections;
    return allSections
      .map((s) => ({
        ...s,
        rows: s.rows.filter((r) => rowMatches(r, q)),
        devRows: s.devRows?.filter((r) => rowMatches(r, q)),
      }))
      .filter((s) => s.rows.length > 0 || (s.devRows?.length ?? 0) > 0);
  }, [allSections, q]);

  const [expanded, setExpanded] = useState<Partial<Record<string, boolean>>>({});
  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  // First paint cascades in after the intro block settles (0.8s); rows
  // mounted later (by expanding a section) animate in immediately.
  const baseDelay = hasRenderedPosts ? 0 : 0.8;

  if (viewMode === 'gallery') {
    return <GalleryGrid rows={sections.flatMap((s) => [...s.rows, ...(s.devRows ?? [])])} seed={gallerySeed} />;
  }

  const gridColumns = isMobile ? 2 : 3;

  // Running index across sections so the initial cascade flows top to bottom.
  let cascade = 0;

  const rowMotion = (i: number, previewCount: number) => ({
    initial: { opacity: 0, y: 8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: {
      duration: 0.9,
      // First paint: cascade top to bottom across sections. Later mounts
      // (expanding a section): stagger from the fold, capped so long
      // sections don't crawl in.
      delay: hasRenderedPosts
        ? Math.min(Math.max(i - previewCount, 0), 12) * 0.025
        : baseDelay + cascade++ * 0.06,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  });

  if (q && sections.length === 0) {
    return <div style={{ fontSize: 14, color: 'var(--fg-dim)', padding: '8px 0' }}>nothing matches “{query.trim()}”</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {sections.map((section) => {
        // Each section has its own layout: projects are icon-tile rows, work
        // is title/year/description rows, photos are always the 3-up image
        // grid.
        const sectionGrid = section.key === 'photos';
        const sectionPreview = sectionGrid ? gridColumns : SECTION_PREVIEW_COUNT;
        // A live search shows every match — no fold to expand.
        const isExpanded = !!q || !!expanded[section.key];
        const visible = isExpanded ? section.rows : section.rows.slice(0, sectionPreview);
        const hiddenCount = q ? 0 : section.rows.length - sectionPreview;
        const devRows = section.devRows ?? [];
        const devExpanded = !!q || !!expanded[`${section.key}-dev`];
        const listRow = (row: Row) =>
          section.key === 'projects' ? <ProjectRow row={row} />
          : section.key === 'work' ? <WorkRow row={row} />
          : <FeedRow row={row} isMobile={isMobile} />;
        const gridStyle = { display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, 1fr)`, gap: isMobile ? 12 : 16, paddingTop: 4 } as const;
        const listStyle = { display: 'flex', flexDirection: 'column' } as const;
        const body = (
          <>
            <div style={sectionGrid ? gridStyle : listStyle}>
              {visible.map((row, i) => (
                <motion.div key={row.key} {...rowMotion(i, sectionPreview)} style={{ minWidth: 0 }}>
                  {sectionGrid
                    ? <GridCard row={row} index={i} isMobile={isMobile} />
                    : listRow(row)}
                </motion.div>
              ))}
            </div>
            {!q && (hiddenCount > 0 || isExpanded || devRows.length > 0) && (
              // Toggles ride the same cascade as the rows above them so they
              // fade in as part of the section, not after it.
              <motion.div
                {...rowMotion(0, sectionPreview)}
                style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: sectionGrid ? 8 : 0 }}
              >
                {(hiddenCount > 0 || isExpanded) && (
                  <SectionToggle
                    label={isExpanded ? 'show less' : `show ${hiddenCount} more`}
                    expanded={isExpanded}
                    onClick={() => toggle(section.key)}
                  />
                )}
                {devRows.length > 0 && (
                  <SectionToggle
                    label={`${devRows.length} in development`}
                    expanded={devExpanded}
                    onClick={() => toggle(`${section.key}-dev`)}
                  />
                )}
              </motion.div>
            )}
            {devExpanded && devRows.length > 0 && (
              <div style={sectionGrid ? gridStyle : listStyle}>
                {devRows.map((row, i) => (
                  <motion.div key={row.key} {...rowMotion(0, sectionPreview)} style={{ minWidth: 0 }}>
                    {sectionGrid
                      ? <GridCard row={row} index={i} isMobile={isMobile} />
                      : listRow(row)}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        );
        // Rail labels arrive last: a slow fade that starts once the row
        // cascade has settled, annotating content that's already there.
        const header = (
          <motion.div
            initial={hasRenderedPosts ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, delay: hasRenderedPosts ? 0 : baseDelay + 1.1, ease: 'easeOut' }}
          >
            <SectionHeader label={section.label} alignEnd={wide} />
          </motion.div>
        );
        return (
          <RailRow key={section.key} label={header} wide={wide}>
            {body}
          </RailRow>
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
          style={{ position: 'absolute', top: 14, right: 16, color: 'var(--fg-dim)', fontSize: 11, letterSpacing: '0.12em' }}
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

// Cursor-tracked image preview: hovering the span floats a card of images
// alongside the pointer. Rendered into a fixed-position div so it can cross
// the column's overflow without clipping.
const HOVER_IMAGES: Record<string, string[]> = {
  cosmo: ['/images/cosmo-1.jpg', '/images/cosmo-2.jpg'],
  hudson: ['https://media.hudbud.net/images/hudson-1.webp'],
};

function CursorImagesHover({ label, images, onClick, className = 'hp-bio-link', style }: {
  label: React.ReactNode;
  images: string[];
  /** Overrides the default click action (opening the image lightbox). */
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const move = (e: React.MouseEvent) => {
    // Touch taps synthesize mousemove right before click; skip the hover card
    // there so it doesn't flash under the lightbox that the tap opens.
    if (window.matchMedia('(hover: none)').matches) return;
    // Keep the card inside the viewport: flip to the left of the cursor near
    // the right edge, and above it near the bottom.
    const W = 460, H = 240, pad = 16;
    const x = e.clientX + pad + W > window.innerWidth ? e.clientX - pad - W : e.clientX + pad;
    const y = e.clientY + pad + H > window.innerHeight ? e.clientY - pad - H : e.clientY + pad;
    setPos({ x, y });
  };

  return (
    <>
    {/* Lightbox lives outside the clickable span so its own clicks (close,
        prev/next) don't bubble back into the open handler and reopen it. */}
    <AnimatePresence>
      {lightboxIdx !== null && (
        <Lightbox images={images} index={lightboxIdx} onClose={() => setLightboxIdx(null)} onChange={setLightboxIdx} />
      )}
    </AnimatePresence>
    <span
      className={className}
      style={{ cursor: 'pointer', ...style }}
      onMouseMove={move}
      onMouseLeave={() => setPos(null)}
      onClick={() => { setPos(null); if (onClick) onClick(); else setLightboxIdx(0); }}
    >
      {label}
      <AnimatePresence>
        {pos && (
          <motion.span
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', left: pos.x, top: pos.y, zIndex: 250, pointerEvents: 'none',
              display: 'flex', gap: 8, padding: 8, background: 'var(--bg-inner)',
              border: '1px solid var(--rule)', borderRadius: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            }}
          >
            {images.map((src) => (
              <img key={src} src={src} alt="" style={{ height: 224, width: 'auto', borderRadius: 3, display: 'block' }} />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
    </>
  );
}

// Render [text](url) spans in bio copy as external links; everything else
// passes through as plain text. An `(hover:key)` target renders a
// cursor-tracked image preview instead of a link.
function renderBioInlineLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const hoverKey = m[2].startsWith('hover:') ? m[2].slice(6) : null;
    if (hoverKey && HOVER_IMAGES[hoverKey]) {
      parts.push(<CursorImagesHover key={m.index} label={m[1]} images={HOVER_IMAGES[hoverKey]} />);
    } else {
      parts.push(
        <a key={m.index} href={m[2]} target="_blank" rel="noopener" className="hp-bio-link">
          {m[1]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ---------- Stream cursor (fish while moving, X when idle) ----------
function StreamCursor() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [moving, setMoving] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = `${e.clientX}px`;
        ref.current.style.top = `${e.clientY}px`;
      }
      setMoving(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setMoving(false), 300);
    };
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div ref={ref} className="hp-stream-cursor" style={{ width: moving ? 64 : 48, height: moving ? 36 : 48, background: moving ? 'transparent' : undefined, backdropFilter: moving ? 'none' : undefined }}>
      <img
        src="/images/fish-cursor.gif"
        alt=""
        style={{ width: 120, height: 'auto', position: 'absolute', opacity: moving ? 1 : 0, transition: 'opacity 0.3s', maxWidth: 'none' }}
      />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ position: 'absolute', opacity: moving ? 0 : 1, transition: 'opacity 0.3s' }}>
        <path d="M4 4L14 14M14 4L4 14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ---------- Watch a Live Stream button ----------
const STREAM_PATH = "M892.257 25.7287C875.988 31.4617 867.787 30.4086 860.544 21.6555C851.098 10.2425 829.601 16.6224 821.878 33.1311C817.987 41.4489 822.868 42.9142 831.165 35.919C843.955 25.1346 847.296 24.6399 854.903 32.4038C862.157 39.8087 870.564 41.3767 888 38.5784C891.085 38.0832 895.346 37.4711 897.468 37.2185C900.687 36.8344 901.538 36.2431 902.599 33.6507C906.163 24.9456 902.482 22.1261 892.257 25.7287ZM906.975 50.295C905.617 50.4095 900.887 50.727 896.464 51.0016C892.04 51.2749 886.914 51.9821 885.071 52.5719C881.681 53.6574 873.917 51.1913 873.655 48.9456C872.478 38.8439 834.128 48.8775 834.536 59.1804C834.762 64.8391 841.006 66.1096 844.524 61.2132C845.836 59.3873 848.349 57.8271 851.568 56.8413C859.673 54.3601 860.575 54.5124 870.602 60.0636C880.365 65.4686 883.364 65.9259 890.203 63.0509C891.665 62.4366 894.878 61.8706 897.342 61.7947C906.162 61.5222 913.213 57.0123 911.632 52.655C910.797 50.3496 910.158 50.0254 906.975 50.295ZM731.847 16.1383C728.419 16.7382 725.069 20.9306 721.434 29.1665C719.824 32.8151 718.444 35.7719 718.368 35.7363C718.292 35.7007 717.192 32.6381 715.924 28.9317C713.247 21.0979 708.771 19.0999 703.312 23.3007C701.865 24.4143 700.451 24.9737 700.169 24.544C698.216 21.56 694.47 24.736 691.981 31.4872C686.51 46.3262 671.408 51.6262 672.204 38.4279C672.5 33.5309 672.167 32.2798 670.254 31.1003C668.647 30.1088 668.288 29.35 669.068 28.5987C670.433 27.2832 669.71 24.013 667.864 23.149C661 19.9382 645.852 29.4648 640.849 40.137C636.491 49.4323 619.716 54.3527 617.755 46.9114C616.933 43.7923 618.901 38.348 620.935 38.1107C623.473 37.8154 634.42 30.289 635.42 28.1513C640.112 18.1216 628.412 16.2561 616.961 25.208C610.635 30.1535 610.618 30.1575 608.964 27.0235C604.901 19.3264 589.258 19.5419 580.646 27.4124C578.005 29.8268 578.005 29.8268 571.204 26.4261C567.461 24.5562 563.577 22.9964 562.57 22.96C561.201 22.9125 560.593 21.7325 560.157 18.2795C559.507 13.1231 555.79 4.94239 553.641 3.93683C552.87 3.57622 552.18 2.77552 552.108 2.1578C551.908 0.437972 546.681 0.725026 545.85 2.50035C545.459 3.33639 545.872 4.88068 546.766 5.93192C547.662 6.98225 548.768 11.1819 549.226 15.2634C549.683 19.3457 550.302 23.0951 550.599 23.5951C550.897 24.0955 549.751 25.6473 548.054 27.0435C543.419 30.8547 545.011 35.077 550.817 34.3732C552.819 34.1304 553.198 34.4932 553.619 37.0639C554.721 43.7873 560.669 59.1142 562.511 59.9756C570.389 63.6614 571.898 58.8702 566.928 45.9411C562.046 33.2398 562.043 33.0904 566.737 36.0504C570.854 38.6465 573.692 43.1826 573.862 47.4349C574.273 57.8142 584.917 63.0134 587.318 54.0075C587.834 52.0739 588.052 49.6511 587.803 48.6237C585.699 39.942 586.714 35.6477 591.674 32.2526C597.597 28.1994 602.796 29.6403 602.381 35.22C602.271 36.6933 602.904 38.4998 603.787 39.2329C604.669 39.9668 605.597 42.7914 605.85 45.5106C606.93 57.1533 620.524 63.2249 631.509 56.9728C636.677 54.0313 636.576 53.995 638.578 59.5179C641.919 68.7329 654.3 69.0758 661.612 60.1566C665.251 55.7164 667.257 54.8258 669.674 56.58C672.044 58.3005 681.404 55.0031 686.777 50.5558C692.429 45.878 692.28 45.6989 692.781 57.7687C693.558 76.439 705.089 72.1635 705.53 53.0414C705.781 42.1187 706.274 40.0144 708.353 40.9869C709.1 41.3365 709.572 41.9295 709.401 42.3053C707.945 45.5061 714.763 59.5523 718.454 60.9592C723.159 62.7517 723.75 62.1239 725.691 53.2561C726.447 49.8052 727.804 43.8493 728.709 40.0218C729.612 36.1939 730.629 31.7447 730.969 30.1338C731.782 26.276 732.462 27.0389 738.656 38.7559C750.891 61.899 759.766 71.7056 768.602 71.8483C774.287 71.9399 778.581 67.0563 778.323 60.7932C778.061 54.4215 774.594 53.0656 771.717 58.2105C769.036 63.006 766.233 61.9709 761.126 54.2976C759.186 51.383 756.875 47.9426 755.992 46.6517C754.177 44.0019 754.238 44.1054 750.011 36.4114C748.303 33.3038 746.113 28.8604 745.144 26.5369C741.929 18.8205 737.281 15.1865 731.847 16.1383ZM751.472 56.1915C751.356 56.4406 751.057 56.5491 750.808 56.4325C750.559 56.316 750.45 56.0169 750.567 55.7678C750.683 55.5187 750.982 55.4102 751.231 55.5268C751.481 55.6433 751.589 55.9424 751.472 56.1915ZM658.311 45.3301C656.948 53.9873 648.331 59.5983 648.691 51.5949C648.825 48.5994 649.324 47.6702 652.379 44.7131C658.315 38.9685 658.383 38.8509 656.653 37.2568C654.639 35.3995 654.812 35.0541 659.124 32.3085C662.621 30.0807 662.621 30.0807 660.841 35.3201C659.863 38.2021 658.724 42.7068 658.311 45.3301ZM542.073 6.75219C540.687 8.08791 540.856 10.3619 542.329 10.1898C543.808 10.0174 545.29 6.65443 544.127 6.11033C543.613 5.86964 542.688 6.15814 542.073 6.75219ZM528.192 17.1145C501.828 30.4923 497.213 41.9126 517.038 44.7156C519.272 45.0309 519.292 45.2469 517.391 48.3873C509.168 61.9726 520.938 70.83 538.164 64.0185C563.192 54.1207 548.543 31.9666 519.786 36.225C511.82 37.4048 512.355 36.5883 526.468 26.0146C528.957 24.1495 532.841 21.9206 535.101 21.0613C539.908 19.2329 541.144 16.4516 538.005 14.5292C536.263 13.4638 534.445 13.9425 528.192 17.1145ZM539.584 49.519C538.838 55.9268 521.459 61.1319 520.871 55.1234C520.258 48.8687 524.051 44.4594 529.35 45.267C536.144 46.3022 539.782 47.8134 539.584 49.519ZM472.445 25.9284C466.196 25.4812 454.382 32.8258 451.524 38.9335C450.523 41.073 449.842 41.4907 448.429 40.8296C447.433 40.3635 446.758 39.6756 446.929 39.2998C447.422 38.2209 443.321 31.8159 441.631 31.0252C434.858 27.8564 429.351 40.0994 430.041 56.7915C430.173 59.9831 428.48 58.3299 427.87 54.6721C426.75 47.9523 426.989 41.147 428.488 37.0441C431.564 28.6285 426.213 26.2288 421.956 34.1159C414.818 47.3383 417.923 71.7345 427.347 76.4733C435.448 80.5483 439.822 73.5041 440.476 55.3254C440.913 43.1855 441.075 42.7544 444.055 45.7792C445.691 47.4401 446.364 49.4796 446.278 52.5194C445.923 65.0961 460.587 74.7307 473.593 70.4638C482.211 67.6363 492.032 59.58 491.548 55.7345C490.895 50.5415 486.413 48.9749 483.75 53.0071C480.636 57.7208 470.897 61.5442 464.575 60.5352C458.09 59.5004 456.345 51.1914 462.114 48.8207C475.355 43.3786 484.87 27.9124 476.019 26.2204C475.852 26.1886 474.244 26.0565 472.445 25.9284ZM363.807 4.19427C358.869 3.30035 357.419 6.2389 358.092 15.7824C358.442 20.7476 358.941 29.132 359.201 34.4149C359.461 39.6978 360.136 45.4785 360.701 47.2608C361.265 49.0427 361.928 52.582 362.173 55.1256C363.657 70.5219 364.208 72.0858 368.924 74.2923C375.361 77.3035 378.768 68.9777 374.139 61.5496C372.09 58.2612 370.269 49.7882 371.189 47.8218C371.416 47.3363 371.311 45.1223 370.956 42.9014C370.601 40.681 369.924 31.3997 369.452 22.2772C368.595 5.6889 368.388 5.02236 363.807 4.19427ZM389.926 28.3645C381.876 32.8069 387.47 70.1918 396.488 72.2213C403.775 73.8615 407.213 67.4018 402.366 61.1765C399.212 57.1228 397.102 47.9706 396.749 36.8006C396.465 27.7967 394.764 25.695 389.926 28.3645ZM300.823 29.4989C299.544 29.6378 298.047 30.2871 297.499 30.9411C296.95 31.5952 294.748 33.9457 292.608 36.1637C283.032 46.088 280.789 63.1424 288.24 69.375C294.345 74.4835 302.127 72.7019 305.545 65.4138C308.592 58.92 310.47 57.9857 315.631 60.4002C323.179 63.9313 331.479 63.0972 334.892 58.4647C338.554 53.4952 333.741 48.6316 327.561 51.0587C321.875 53.2916 318.747 50.5199 317.296 41.9638C316.938 39.8544 315.943 38.4658 314.204 37.6522C312.793 36.9925 310.463 35.1568 309.023 33.5727C305.899 30.1338 303.941 29.1604 300.823 29.4989ZM305.588 40.7977C305.174 41.8182 304.759 44.107 304.665 45.8837C304.357 51.7612 296.82 63.0322 294.381 61.2616C291.068 58.8575 294.681 42.7741 299.607 37.9984C302.158 35.5264 306.839 37.7176 305.588 40.7977ZM195.866 7.32294C192.228 8.93749 191.629 10.3341 192.28 15.6873C192.571 18.0879 192.905 23.2498 193.021 27.1572C193.72 50.5783 203.988 64.0827 209.147 48.3669C215.986 27.5342 226.664 24.2271 229.896 41.9422C230.488 45.1832 230.811 48.1774 230.616 48.5959C230.011 49.8884 233.128 58.236 234.446 58.8525C241.431 62.1201 246.986 54.9238 243.753 46.794C242.674 44.0834 241.664 40.2525 241.506 38.282C240.872 30.3122 232.394 21.7367 224.872 21.455C219.542 21.2553 209.538 25.2131 208.213 28.0455C206.096 32.5708 204.3 29.2387 204.063 20.3499C203.905 14.4259 202.473 8.40552 201.32 8.82344C200.873 8.9854 200.698 8.71038 200.931 8.2122C201.703 6.56368 198.748 6.04573 195.866 7.32294ZM177.617 16.7492C172.018 16.4746 166.206 22.2862 161.029 33.3378C150.626 55.5452 167.637 66.4012 185.556 48.99C193.709 41.0676 190.786 35.1692 181.793 41.3957C171.512 48.5129 169.955 48.3697 169.811 40.2895C169.69 33.3943 171.036 30.9371 178.017 25.3179C183.565 20.8521 183.387 17.0327 177.617 16.7492ZM130.096 1.36672C127.93 3.34732 127.62 4.13335 127.862 7.03536C128.018 8.88877 127.923 10.8816 127.653 11.4648C127.382 12.0481 127.24 15.0067 127.337 18.0386C127.545 24.5191 126.547 27.0145 121.991 31.4177C117.434 35.8228 119.154 38.4456 126.947 38.977C128.009 39.0499 128.688 40.2576 128.899 42.4518C129.609 49.8206 133.773 59.2275 136.991 60.7331C145.148 64.549 148.301 56.1055 142.189 46.8111C139.248 42.3372 136.786 34.2799 138.18 33.6888C145.365 30.6415 147.851 29.9088 151.425 29.7843C158.704 29.5301 160.929 25.4095 155.82 21.6449C153.811 20.1654 151.701 19.8679 146.094 20.2744C137.687 20.8833 136.638 20.568 137.923 17.8198C142.272 8.52564 136.208 -4.21963 130.096 1.36672ZM95.7802 31.6453C94.63 31.7487 92.156 30.8871 90.2832 29.7316C82.8792 25.166 76.6694 28.9104 69.3332 42.3666C61.8244 56.1372 64.5685 67.048 76.0536 69.0847C79.5754 69.71 85.9111 65.4063 89.3698 60.0403C93.467 53.6824 94.1915 53.5544 98.8573 58.3659C106.948 66.7072 118.75 68.2431 121.964 61.3736C123.864 57.3112 118.788 51.248 114.82 52.8416C111.586 54.1406 102.341 44.387 103.801 41.216C105.49 37.5479 100.211 31.2484 95.7802 31.6453ZM56.2745 22.9737C50.4545 24.8537 47.9985 29.0911 45.779 41.0802C42.1031 60.9376 42.0796 60.9642 32.8947 55.5753C24.9624 50.9215 19.8968 52.121 16.59 59.4348C13.1208 67.1099 11.6085 63.6854 11.7175 48.3916C11.7535 43.3046 11.78 37.9051 11.7764 36.3931C11.7674 32.5634 8.3394 29.328 5.41444 30.3884C-0.508613 32.5359 -2.09914 63.8956 3.30435 72.0198C4.35902 73.6073 4.92403 75.0143 4.55841 75.1469C4.00799 75.3464 12.7445 79.3905 15.2416 80.0917C16.8789 80.5519 22.4209 75.9033 23.8389 72.8793C25.6863 68.9422 27.6868 68.1139 31.305 69.7911C42.0168 74.7549 51.267 72.7641 53.4737 65.0195C54.2029 62.4626 55.2278 59.0802 55.7512 57.5034C56.2756 55.9271 57.098 51.5922 57.5794 47.8705C58.0609 44.1488 58.6703 39.5211 58.9326 37.587C59.2862 34.9879 60.1317 33.3057 62.1783 31.1377C66.7993 26.2393 62.8917 20.8364 56.2745 22.9737ZM87.7275 39.3643C88.4665 41.4025 86.3934 45.6779 80.8419 53.5656C77.9167 57.7227 75.7613 56.2628 76.5771 50.6772C78.1579 39.8433 85.2803 32.6165 87.7275 39.3643Z";

function WatchLiveStreamButton({ onOpen }: { onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hovered && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else if (!hovered && videoRef.current) {
      videoRef.current.pause();
    }
  }, [hovered]);

  return (
    <div
      ref={containerRef}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', cursor: 'pointer', width: 'fit-content', lineHeight: 0 }}
    >
      <svg width="912" height="81" viewBox="0 0 912 81" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', maxWidth: 200, height: 'auto', opacity: hovered ? 0 : 1, transition: 'opacity 0.2s' }}>
        <path fillRule="evenodd" clipRule="evenodd" d={STREAM_PATH} fill="var(--fg-dim)" />
      </svg>
      <div style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.2s',
      }}>
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <clipPath id="stream-text-clip" clipPathUnits="objectBoundingBox">
              <path transform="scale(0.0010964912, 0.012345679)" d={STREAM_PATH} />
            </clipPath>
          </defs>
        </svg>
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            clipPath: 'url(#stream-text-clip)',
            WebkitClipPath: 'url(#stream-text-clip)',
          }}
        >
          <source src="/intro/intro.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

// ---------- Copy-email link ----------
// Clicking copies the address instead of launching a mail client; the hover
// tooltip doubles as the confirmation ("email" -> "copied!").
function CopyEmailLink() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const copy = () => {
    navigator.clipboard.writeText('hudbud@gmail.com').then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => {
      // Clipboard unavailable (permissions/http) — fall back to mailto.
      window.location.href = 'mailto:hudbud@gmail.com';
    });
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      onClick={copy}
      className="hp-bio-link hp-tip"
      data-tip={copied ? 'copied!' : 'copy email'}
      aria-label="copy email address"
      style={{ color: copied ? 'var(--accent)' : undefined, font: 'inherit', padding: 0 }}
    >
      em
    </button>
  );
}

// ---------- Left column ----------
function LeftColumn({ activePost, activeProject, setActivePost, onOpenProject, onOpenBioModal, onHome, onWatchStream, onOpenAbout, feed, viewMode, setViewMode, scrollRef, isMobile, wide }: {
  activePost: Post | null;
  activeProject: string | null;
  setActivePost: (p: Post | null) => void;
  onOpenProject: (id: string) => void;
  onOpenBioModal: (id: string) => void;
  onHome: () => void;
  onWatchStream: () => void;
  onOpenAbout: () => void;
  feed: Post[];
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
  isMobile: boolean;
  /** Rail-grid layout: sticky labels in the left rail, 34rem center column. */
  wide: boolean;
}) {
  const [gallerySeed, setGallerySeed] = useState(1);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Track if this is the first time posts are rendering (persists across re-renders)
  const hasRenderedPostsRef = useRef(false);
  useEffect(() => {
    hasRenderedPostsRef.current = true;
  });

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  // Header: display headline + all the bio copy. In wide mode the logo holds
  // the right rail (mirroring the reference layout's portrait) and the
  // headline/bio sit in the 34rem center column.
  const header = (
    <RailRow
      wide={wide}
      label={wide ? (
        <motion.div {...fade(0.1)} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <HudMark size={52} onClick={onHome} />
        </motion.div>
      ) : null}
    >
      {!wide && (
        <motion.div style={{ marginBottom: 14 }} {...fade(0.1)}>
          <HudMark size={46} onClick={onHome} />
        </motion.div>
      )}

      {/* Name — hover previews the office selfie, click opens the about-me
          post in the detail panel like any other post. */}
      <motion.h1
        style={{ margin: 0, marginBottom: 16, fontSize: 16, fontWeight: 400 }}
        {...fade(0.2)}
      >
        <CursorImagesHover
          label="Hudson Paine"
          images={HOVER_IMAGES.hudson}
          onClick={onOpenAbout}
          className=""
          style={{ color: 'var(--accent)', letterSpacing: '0.01em' }}
        />
      </motion.h1>

      {/* Bio text — each \n-separated line of BIO_LEAD is its own paragraph. */}
      <motion.div {...fade(0.3)}>
        {BIO_LEAD.split('\n').map((para, i) => (
          <p key={i} style={{ color: 'var(--fg)', margin: 0, marginBottom: 14, fontSize: 16, letterSpacing: '-0.011em', lineHeight: 1.7 }}>
            {renderBioInlineLinks(para)}
          </p>
        ))}
      </motion.div>

      <motion.div
        style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 16, alignItems: 'center', marginTop: 4 }}
        {...fade(0.5)}
      >
        <CopyEmailLink />
        <a href="https://www.cosmos.so/hudbud" target="_blank" rel="noopener" className="hp-bio-link hp-tip" data-tip="cosmos">co</a>
        <a href="https://www.youtube.com/@hudbud22" target="_blank" rel="noopener" className="hp-bio-link hp-tip" data-tip="youtube">yt</a>
        <a href="https://www.linkedin.com/in/hudsonpaine" target="_blank" rel="noopener" className="hp-bio-link hp-tip" data-tip="linkedin">li</a>
        <span style={{ marginLeft: 'auto' }}><WatchLiveStreamButton onOpen={onWatchStream} /></span>
      </motion.div>
    </RailRow>
  );

  const viewToggle = (
    <RailRow wide={wide} label={null}>
      <motion.div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
        {...fade(0.6)}
      >
        {searchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 1 220px', minWidth: 0, padding: '7px 10px', borderRadius: 8, background: 'var(--tile)' }}>
            <MagnifyingGlass size={13} color="var(--fg-dim)" style={{ flexShrink: 0 }} />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => { if (!query.trim()) setSearchOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
              placeholder="search"
              aria-label="search posts"
              className="hp-search-input"
              style={{
                flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
                fontFamily: 'inherit', fontSize: 14, color: 'var(--fg)', padding: 0,
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSearchOpen(false); }}
                aria-label="clear search"
                style={{ display: 'flex', color: 'var(--fg-dim)', padding: 0, fontSize: 12, lineHeight: 1 }}
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="search posts"
            title="search"
            style={{ display: 'flex', padding: '8px 10px', borderRadius: 8, background: 'var(--tile)', color: 'var(--fg-dim)', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
          >
            <MagnifyingGlass size={14} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {viewMode === 'gallery' && (
            <button
              onClick={() => setGallerySeed((s) => s + 1)}
              aria-label="shuffle gallery"
              title="shuffle gallery"
              style={{ display: 'flex', padding: '8px 10px', borderRadius: 8, background: 'var(--tile)', color: 'var(--fg-dim)', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
            >
              <Shuffle size={14} weight="fill" />
            </button>
          )}
          <ViewModeToggle mode={viewMode} setMode={setViewMode} />
        </div>
      </motion.div>
    </RailRow>
  );

  return (
    <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto' }}>
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 24,
      padding: isMobile ? '32px 20px 120px' : '56px 40px 120px 48px',
      minHeight: '100%', justifyContent: 'flex-start',
    }}>
      {header}
      {viewToggle}

      <Feed
        feed={feed}
        activePost={activePost}
        activeProject={activeProject}
        setActivePost={setActivePost}
        openProject={onOpenProject}
        viewMode={viewMode}
        gallerySeed={gallerySeed}
        hasRenderedPosts={hasRenderedPostsRef.current}
        isMobile={isMobile}
        wide={wide}
        query={query}
      />
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

// ---------- Editorial detail-page furniture ----------
// The minimal case-study look: a short mono-caps spec stack (values only, no
// labels, left-aligned) under a heavy lowercase display title, images
// numbered FIG. 01… like plates in a printed portfolio.
function specRowsFor(post: Post): { label: string; value: string; accent?: boolean; mono?: boolean }[] {
  const isWork = post.tags.includes('work') || post.tags.includes('archive') || post.tags.includes('projects');
  // Custom dateLabels ("active", "2022 – 2025") come through post.date; plain
  // mm.dd.yyyy dates collapse to their year.
  const year = /^\d{2}\.\d{2}\.\d{4}$/.test(post.date) ? String(new Date(post.dateValue).getFullYear()) : post.date;
  if (!isWork) {
    return [{ label: 'date', value: post.date, mono: true }];
  }
  const rows: { label: string; value: string; accent?: boolean; mono?: boolean }[] = [
    { label: 'year', value: year, mono: true },
  ];
  if (post.discipline || post.category) rows.push({ label: 'discipline', value: post.discipline ?? post.category!, accent: true });
  if (post.roles) rows.push({ label: 'role', value: post.roles });
  if (post.tools) rows.push({ label: 'tools', value: post.tools });
  return rows;
}

// Dates/years keep the mono spec voice; wordy rows (discipline, roles,
// tools) read in the body font like every other label on the site.
function SpecTable({ rows }: { rows: { label: string; value: string; accent?: boolean; mono?: boolean }[] }) {
  return (
    <div className="post-spec" style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '26px 0 30px' }}>
      {rows.map((r) => (
        <div
          key={r.label}
          className={r.mono ? 'post-spec-cell' : undefined}
          style={{ fontSize: r.mono ? undefined : 14, color: r.accent ? 'var(--accent)' : 'var(--fg-dim)', padding: '5px 0' }}
        >
          {r.value}
        </div>
      ))}
    </div>
  );
}

function ClosePill({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ position: 'sticky', top: 0, alignSelf: 'flex-end', zIndex: 10, marginBottom: 8 }}>
      <button
        onClick={onClick}
        className="post-spec-cell"
        style={{ background: 'var(--fg)', color: 'var(--bg)', borderRadius: 999, padding: '10px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fg)')}
      >
        ✕ close
      </button>
    </div>
  );
}

function DisplayTitle({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) {
  return (
    <div style={{ fontSize: isMobile ? 34 : 44, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.02, color: 'var(--fg)', margin: '18px 0 0' }}>
      {children}
    </div>
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
  // Imported posts often reuse the first body paragraph as the excerpt —
  // skip the lede then so the text doesn't render twice. Checked against the
  // real body only, so the lede still shows while the html is loading.
  const showLede = !!post.excerpt && (isLoadingHtml || !isExcerptRedundant(postHtml, post.excerpt));
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
  const isWork = post.tags.includes('work') || post.tags.includes('archive') || post.tags.includes('projects');
  const hasImage = (isLife && (post.img || post.feature_image)) || (isWork && post.feature_image);

  // Hero (rendered here) is FIG. 01; figure numbering in the body continues after it.
  const bodyHtml = useMemo(
    () => addFigCaptions(groupImagesIntoGrid(stripMetaParagraphs(postHtml)), post.title, post.feature_image && hasImage ? 2 : 1),
    [postHtml, post.title, post.feature_image, hasImage]
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isMobile ? '16px 20px 80px' : '32px 56px 80px 48px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ClosePill onClick={onClose} />

      <DisplayTitle isMobile={isMobile}>{post.title}</DisplayTitle>

      <SpecTable rows={specRowsFor(post)} />

      {showLede && (
        <p className="prose" style={{ color: 'var(--fg)', fontSize: 16, lineHeight: 1.7, margin: '0 0 28px', maxWidth: 520 }}>{post.excerpt}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        <button
          onClick={() => { setShowSpritz(!showSpritz); setShowTyping(false); }}
          className="post-spec-cell"
          style={{ color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '5px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showSpritz ? 'hide speed reader' : <><Lightning size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />speed read</>}
        </button>
        <button
          onClick={() => { setShowTyping(!showTyping); setShowSpritz(false); }}
          className="post-spec-cell"
          style={{ color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '5px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showTyping ? 'hide typing test' : <><Keyboard size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />typing test</>}
        </button>
        {post.slug && (
          <button
            onClick={copyLink}
            aria-label="copy link to post"
            style={{ display: 'flex', alignItems: 'center', color: copied ? 'var(--accent)' : 'var(--fg-faint)', marginLeft: 'auto' }}
            onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--fg-dim)'; }}
            onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--fg-faint)'; }}
          >
            {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
          </button>
        )}
      </div>

      {showSpritz && <SpritzReader html={postHtml} onClose={() => setShowSpritz(false)} />}
      {showTyping && <TypingTest html={postHtml} onClose={() => setShowTyping(false)} />}

      {hasImage && (
        <figure className="post-fig" style={{ margin: '0 0 24px' }}>
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
          <figcaption className="post-fig-caption">fig. 01 — {post.title}</figcaption>
        </figure>
      )}

      {isLoadingHtml ? (
        <div style={{ color: 'var(--fg-dim)', fontSize: 13, padding: '8px 0 20px' }}>loading…</div>
      ) : (
        <div ref={proseRef} className="prose" style={{ color: 'var(--fg)', fontSize: 16, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      )}
      <style>{`.prose img { cursor: pointer; }`}</style>

      <AnimatePresence>
        {lightboxIdx !== null && (
          <Lightbox images={postImages} index={lightboxIdx} onClose={() => setLightboxIdx(null)} onChange={setLightboxIdx} />
        )}
      </AnimatePresence>

      <div className="post-spec-cell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 36, paddingTop: 18, borderTop: '1px solid var(--rule)', color: 'var(--fg-dim)' }}>
        <span>~{minutes} min read</span>
        {post.slug && (
          <a
            href={`/posts/${post.slug}`}
            style={{ color: 'var(--fg-dim)', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
          >
            full post ↗
          </a>
        )}
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
      <div style={{ height: '100%', overflowY: 'auto', padding: '24px 24px 80px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <ClosePill onClick={onClose} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, padding: '0 8px' }}>
          <div className="post-spec-cell" style={{ color: 'var(--fg-dim)' }}>project · tool</div>
          <a
            href="/freezer-martini"
            className="post-spec-cell"
            style={{ color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '5px 10px' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
          >
            ↗ expand full page
          </a>
        </div>
        <FreezerMartini embedded />
      </div>
    );
  }

  const project = PROJECT_CONTENT[projectId];
  if (!project) return null;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: isMobile ? '16px 20px 80px' : '32px 48px 80px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <ClosePill onClick={onClose} />

      <DisplayTitle isMobile={isMobile}>{project.title}</DisplayTitle>

      <SpecTable rows={project.subtitle ? [{ label: 'context', value: project.subtitle }] : []} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => { setShowSpritz(!showSpritz); setShowTyping(false); }}
          className="post-spec-cell"
          style={{ color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '5px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showSpritz ? 'hide speed reader' : <><Lightning size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />speed read</>}
        </button>
        <button
          onClick={() => { setShowTyping(!showTyping); setShowSpritz(false); }}
          className="post-spec-cell"
          style={{ color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '5px 10px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-dim)'; e.currentTarget.style.borderColor = 'var(--rule)'; }}
        >
          {showTyping ? 'hide typing test' : <><Keyboard size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />typing test</>}
        </button>
      </div>

      {showSpritz && <SpritzReader html={project.html} onClose={() => setShowSpritz(false)} />}
      {showTyping && <TypingTest html={project.html} onClose={() => setShowTyping(false)} />}

      <div className="prose" style={{ color: 'var(--fg)', fontSize: 16, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: project.html }} />
    </div>
  );
}

// ---------- FrameFooter ----------
// Lives in the outer border padding around the site (desktop only).
function FrameFooter() {
  // null until mount: the server-rendered time can never match the client's,
  // and that one stale string used to fail hydration for the whole app.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const time = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : '--:--:--';
  const date = now ? `${pad(now.getMonth() + 1)}.${pad(now.getDate())}.${now.getFullYear()}` : '';

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

// ---------- Time machine overlay ----------
// Replays an archived version of the site inside a fullscreen iframe. Wayback
// cold fetches can take several seconds, so a "traveling…" message holds the
// space until the iframe fires onLoad.
function TimeTravelOverlay({ version, onClose }: { version: SiteVersion; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div {...OVERLAY_FADE} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
        <span style={{ fontSize: 11, color: 'var(--fg-dim)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <ClockCounterClockwise size={13} weight="fill" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {version.label} — via the wayback machine
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {version.pageUrl && (
            <a
              href={version.pageUrl}
              target="_blank"
              rel="noopener"
              style={{ fontSize: 11, color: 'var(--fg-dim)', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
            >
              open on archive.org ↗
            </a>
          )}
          <button
            onClick={onClose}
            style={{ fontSize: 11, color: 'var(--fg-dim)', border: '1px solid var(--rule)', borderRadius: 2, padding: '4px 12px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
          >
            ✕ back to {new Date().getFullYear()}
          </button>
        </span>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--fg-dim)', fontSize: 12 }}>
            traveling to {version.label}…
          </div>
        )}
        <iframe
          src={version.url}
          onLoad={() => setLoaded(true)}
          style={{ position: 'absolute', inset: 0, border: 'none', width: '100%', height: '100%', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        />
      </div>
    </motion.div>
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

  // Accessibility mode: reduced motion + contrast-checked theme palette.
  // Persisted so the head script constrains the random theme on future loads.
  const [a11y, setA11y] = useState(false);
  const toggleA11y = () => {
    const next = !a11y;
    setA11y(next);
    localStorage.setItem('hp-a11y', next ? '1' : '0');
    document.documentElement.classList.toggle('hp-a11y', next);
    // If the current theme fails the contrast floor, hop to a safe one now.
    if (next && !SAFE_THEME_NAMES.includes(theme)) {
      setTheme(SAFE_THEME_NAMES[Math.floor(Math.random() * SAFE_THEME_NAMES.length)]);
    }
  };

  const [activePost, setActivePostRaw] = useState<Post | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [showStream, setShowStream] = useState(false);

  // Reconcile deferred, client-only state: the theme/font the inline head
  // script already painted, lock flags, and any ?post= deep link.
  useEffect(() => {
    const initial = readHpInitial();
    if (initial) {
      setThemeRaw(initial.theme);
      setFontRaw(initial.font);
      setA11y(!!initial.a11y);
    }
    setThemeLocked(!!localStorage.getItem('hp-lock-theme'));
    setFontLocked(!!localStorage.getItem('hp-lock-font'));

    const postSlug = new URLSearchParams(window.location.search).get('post');
    if (postSlug) {
      const found = feed.find((p) => p.slug === postSlug);
      if (found) setActivePostRaw(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [bioModal, setBioModal] = useState<string | null>(null);
  const [showThoughts, setShowThoughts] = useState(false);
  const [timeTravel, setTimeTravel] = useState<SiteVersion | null>(null);

  // ?thoughts=open deep link (used by the RSS item links).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('thoughts') === 'open') setShowThoughts(true);
  }, []);

  // Opening a panel pushes a history entry so the phone's back gesture closes
  // it instead of leaving the site (the panel is fullscreen on mobile). Only
  // one entry is pushed no matter how many posts are viewed in a row.
  const panelOpenRef = useRef(false);
  const pushPanelState = () => {
    if (!panelOpenRef.current) {
      window.history.pushState({ hpPanel: true }, '');
      panelOpenRef.current = true;
    }
  };
  const setActivePost = (p: Post | null) => {
    setActivePostRaw(p); setActiveProject(null);
    if (p) pushPanelState();
    else if (panelOpenRef.current) { panelOpenRef.current = false; window.history.back(); }
  };
  const openProject = (id: string) => { setActiveProject(id); setActivePostRaw(null); pushPanelState(); };
  const closeRightPanel = () => {
    setActivePostRaw(null); setActiveProject(null);
    if (panelOpenRef.current) { panelOpenRef.current = false; window.history.back(); }
  };
  useEffect(() => {
    const onPop = () => {
      if (panelOpenRef.current) {
        panelOpenRef.current = false;
        setActivePostRaw(null);
        setActiveProject(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  const currentTheme = MT_THEMES.find((t) => t.name === theme);
  const showVideoBackground = currentTheme?.videoBackground ?? false;

  useEffect(() => {
    document.body.dataset.font = font;
  }, [font]);

  // Wheel events over dead zones (centering spacers, outer frame) should
  // still scroll the feed. If the event originated inside any element that
  // scrolls on its own (feed column, detail panel, glass menus), native
  // scrolling already handles it — only forward the leftovers.
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const handleFrameWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.scrollHeight > el.clientHeight) {
        const oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') return;
      }
      el = el.parentElement;
    }
    leftScrollRef.current?.scrollBy({ top: e.deltaY });
  };

  const panelOpen = !!(activePost || activeProject);
  // Rail-grid (editorial) layout only when the column has the full page to
  // itself; the open-panel 50% column and mobile fall back to stacked labels.
  const wide = !isMobile && !panelOpen;
  const rightContent = activePost
    ? <PostPanel post={activePost} onClose={closeRightPanel} isMobile={isMobile} />
    : activeProject
      ? <ProjectPanel projectId={activeProject} onClose={closeRightPanel} isMobile={isMobile} />
      : null;

  return (
    <MotionConfig reducedMotion={a11y ? 'always' : 'user'}>
    <div onWheel={handleFrameWheel} style={{ height: '100dvh', padding: isMobile ? 0 : 20, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
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
        {/* Video background for livestream themes */}
        {showVideoBackground && (
          <video
            autoPlay
            muted
            playsInline
            loop
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: theme === 'livestream' ? 0.4 : 0.15,
              pointerEvents: 'none',
              zIndex: 0,
              filter: theme === 'livestream' ? 'none' : 'grayscale(1)',
            }}
          >
            <source src="/intro/intro.mp4" type="video/mp4" />
          </video>
        )}
        {/* Left column: full width in wide mode (the rail grid centers its
            own 34rem column), 50% when the detail panel is open. */}
        {(!isMobile || !panelOpen) && (
          <div style={{
            flexShrink: 0,
            width: isMobile || !panelOpen ? '100%' : '50%',
            transition: isMobile ? undefined : 'width 0.42s cubic-bezier(0.4, 0, 0.2, 1)',
            overflowY: 'auto',
            height: '100%',
            position: 'relative',
            zIndex: 1,
          }}>
            <LeftColumn
              activePost={activePost}
              activeProject={activeProject}
              setActivePost={setActivePost}
              onOpenProject={openProject}
              onOpenBioModal={setBioModal}
              onHome={closeRightPanel}
              onWatchStream={() => setShowStream(true)}
              onOpenAbout={() => { const p = feed.find((r) => r.slug === 'about-me'); if (p) setActivePost(p); }}
              feed={feed}
              viewMode={viewMode}
              setViewMode={setViewMode}
              scrollRef={leftScrollRef}
              isMobile={isMobile}
              wide={wide}
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
            position: 'relative',
            zIndex: 1,
          }}>
            {rightContent}
          </div>
        )}
      </div>

      {(() => {
        const chromeProps: ChromeProps = {
          theme, setTheme, font, setFont,
          onTimeTravel: setTimeTravel,
          onOpenResource: (slug: string) => { const p = feed.find(r => r.slug === slug); if (p) setActivePost(p); },
          onOpenThoughts: () => setShowThoughts(true),
          themeLocked, fontLocked,
          onToggleThemeLock: toggleThemeLock, onToggleFontLock: toggleFontLock,
          a11y, onToggleA11y: toggleA11y,
        };
        return isMobile ? <MobileChrome {...chromeProps} /> : <DesktopChrome {...chromeProps} />;
      })()}

      <AnimatePresence>
        {bioModal && <BioModal key="bio" modalId={bioModal} onClose={() => setBioModal(null)} />}
        {showThoughts && <ThoughtsModal key="thoughts" onClose={() => setShowThoughts(false)} />}
        {showStream && (
          <motion.div
            key="stream"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setShowStream(false)}
            className="hp-stream-overlay"
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <style>{`.hp-stream-overlay { cursor: none; } .hp-stream-overlay .hp-stream-cursor { pointer-events: none; position: fixed; width: 48px; height: 48px; border-radius: 50%; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); z-index: 9999; }`}</style>
            <video autoPlay muted playsInline loop style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}>
              <source src="/intro/intro.mp4" type="video/mp4" />
            </video>
            <StreamCursor />
          </motion.div>
        )}
      </AnimatePresence>
      {timeTravel && <TimeTravelOverlay version={timeTravel} onClose={() => setTimeTravel(null)} />}
    </div>
    </MotionConfig>
  );
}
