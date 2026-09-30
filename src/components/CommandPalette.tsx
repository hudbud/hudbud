// ⌘K search palette, mounted once in the Layout so every page gets it.
// The index (/search.json) loads on first open; suggestions, pages, links,
// and actions are static and show before a query is typed.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlass, Briefcase, Cube, Camera, ChatCircleText, BookOpen, House, User, Copy, Check,
  DownloadSimple, Palette, LinkSimple, Planet, IdentificationCard,
} from '@phosphor-icons/react';
import { MT_THEMES, SAFE_THEME_NAMES } from '../data/themes';
import { applyThemeVars } from './chrome';
import { LINKS } from '../data/resume';
import type { SearchItem, SearchKind } from '../lib/posts';

const EMAIL = 'hudbud@gmail.com';
const RESUME_URL = LINKS.find((l) => l.label === 'resume')?.href ?? '/about';

type Group = 'suggestions' | 'pages' | 'work' | 'projects' | 'photos' | 'writing' | 'experience' | 'links';

interface Entry {
  id: string;
  group: Group;
  title: string;
  sub?: string;
  chip: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  action?: 'copy-email' | 'roll-theme';
  text: string;
}

const GROUP_LABEL: Record<Group, string> = {
  suggestions: 'suggestions', pages: 'pages', work: 'work', projects: 'projects',
  photos: 'photos', writing: 'writing', experience: 'experience', links: 'links',
};
const KIND_GROUP: Record<SearchKind, Group> = { work: 'work', project: 'projects', photos: 'photos', thought: 'writing', resource: 'writing' };
const KIND_CHIP: Record<SearchKind, string> = { work: 'case study', project: 'project', photos: 'photos', thought: 'thought', resource: 'resource' };
const ICON_SIZE = 18;
const KIND_ICON: Record<SearchKind, ReactNode> = {
  work: <Briefcase size={ICON_SIZE} />,
  project: <Cube size={ICON_SIZE} />,
  photos: <Camera size={ICON_SIZE} />,
  thought: <ChatCircleText size={ICON_SIZE} />,
  resource: <BookOpen size={ICON_SIZE} />,
};

const STATIC: Entry[] = [
  { id: 's-work', group: 'suggestions', title: 'View my work', sub: 'Case studies, projects, and client work', chip: 'suggestion', icon: <Briefcase size={ICON_SIZE} />, href: '/', text: 'work portfolio case studies projects home' },
  { id: 's-email', group: 'suggestions', title: 'Copy my email', sub: EMAIL, chip: 'suggestion', icon: <Copy size={ICON_SIZE} />, action: 'copy-email', text: `copy email contact mail hire ${EMAIL}` },
  { id: 's-resume', group: 'suggestions', title: 'Download my resume', sub: 'The latest PDF', chip: 'suggestion', icon: <DownloadSimple size={ICON_SIZE} />, href: RESUME_URL, external: true, text: 'resume cv pdf download' },
  { id: 's-about', group: 'suggestions', title: 'Learn about me', sub: 'Skills, experience, and bios of years past', chip: 'suggestion', icon: <User size={ICON_SIZE} />, href: '/about', text: 'about me bio hudson paine skills experience' },
  { id: 's-colors', group: 'suggestions', title: 'Roll the colors', sub: 'Repaint the site in a random theme', chip: 'action', icon: <Palette size={ICON_SIZE} />, action: 'roll-theme', text: 'theme colors random palette dark light shuffle' },
  { id: 'p-home', group: 'pages', title: 'Home', chip: 'page', icon: <House size={ICON_SIZE} />, href: '/', text: 'home index' },
  { id: 'p-about', group: 'pages', title: 'About', chip: 'page', icon: <IdentificationCard size={ICON_SIZE} />, href: '/about', text: 'about me bio' },
  { id: 'p-thoughts', group: 'pages', title: 'Thoughts', sub: 'Short notes and half-formed ideas', chip: 'page', icon: <ChatCircleText size={ICON_SIZE} />, href: '/?thoughts=open', text: 'thoughts notes blog writing' },
  { id: 'p-space', group: 'pages', title: 'Space', sub: 'Every post as a node graph', chip: 'page', icon: <Planet size={ICON_SIZE} />, href: '/graph', text: 'space graph map nodes' },
  { id: 'l-linkedin', group: 'links', title: 'LinkedIn', chip: 'link', icon: <LinkSimple size={ICON_SIZE} />, href: 'https://www.linkedin.com/in/hudsonpaine', external: true, text: 'linkedin' },
  { id: 'l-github', group: 'links', title: 'GitHub', sub: 'This site is open source', chip: 'link', icon: <LinkSimple size={ICON_SIZE} />, href: 'https://github.com/hudbud/hudbud', external: true, text: 'github code source repo' },
  { id: 'l-youtube', group: 'links', title: 'YouTube', chip: 'link', icon: <LinkSimple size={ICON_SIZE} />, href: 'https://www.youtube.com/@hudbud22', external: true, text: 'youtube video' },
  { id: 'l-cosmos', group: 'links', title: 'Cosmos', chip: 'link', icon: <LinkSimple size={ICON_SIZE} />, href: 'https://www.cosmos.so/hudbud', external: true, text: 'cosmos inspiration moodboard' },
  { id: 'l-studio', group: 'links', title: 'Cosmo Studio', chip: 'link', icon: <LinkSimple size={ICON_SIZE} />, href: 'https://cosmostud.io', external: true, text: 'cosmo studio agency' },
];

let indexPromise: Promise<Entry[]> | null = null;
function loadIndex(): Promise<Entry[]> {
  if (!indexPromise) {
    indexPromise = fetch('/search.json')
      .then((r) => r.json())
      .then((d: { items: SearchItem[]; resume: { title: string; sub: string; href: string; text: string }[] }) => [
        ...d.items.map((it, i): Entry => ({
          id: `i-${i}`,
          group: KIND_GROUP[it.kind],
          title: it.title,
          sub: it.sub,
          chip: it.year && it.year !== '-' ? `${KIND_CHIP[it.kind]} · ${it.year}` : KIND_CHIP[it.kind],
          icon: KIND_ICON[it.kind],
          href: it.href,
          external: it.external,
          text: it.text,
        })),
        ...d.resume.map((r, i): Entry => ({
          id: `r-${i}`, group: 'experience', title: r.title, sub: r.sub, chip: 'experience',
          icon: <Briefcase size={ICON_SIZE} />, href: r.href, text: r.text,
        })),
      ])
      .catch(() => { indexPromise = null; return []; });
  }
  return indexPromise;
}

// Every term has to hit somewhere; title hits outrank body hits, and a title
// that starts with the query outranks everything.
function score(entry: Entry, terms: string[], q: string): number {
  const title = entry.title.toLowerCase();
  const sub = (entry.sub ?? '').toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (title.startsWith(t)) s += 12;
    else if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(title)) s += 8;
    else if (title.includes(t)) s += 5;
    else if (sub.includes(t)) s += 3;
    else if (entry.text.includes(t)) s += 1;
    else return 0;
  }
  if (title === q) s += 20;
  return s;
}

const PER_GROUP = 6;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<Entry[]>([]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback(() => {
    setOpen(true);
    loadIndex().then(setIndex);
  }, []);
  const hide = useCallback(() => { setOpen(false); setQuery(''); setCopied(false); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) hide(); else show();
      }
    };
    const onOpen = () => show();
    window.addEventListener('keydown', onKey);
    window.addEventListener('hp:search', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('hp:search', onOpen); };
  }, [open, show, hide]);

  // Lock the page behind the palette.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return STATIC;
    const terms = q.split(/\s+/);
    const scored = [...STATIC.filter((e) => e.group !== 'suggestions' || e.action), ...index]
      .map((e) => ({ e, s: score(e, terms, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    const byGroup = new Map<Group, Entry[]>();
    for (const { e } of scored) {
      const list = byGroup.get(e.group) ?? [];
      if (list.length < PER_GROUP) list.push(e);
      byGroup.set(e.group, list);
    }
    // Groups follow the best hit, so the top result is always first.
    const groups = [...byGroup.keys()];
    return groups.flatMap((g) => byGroup.get(g)!);
  }, [query, index]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (entry: Entry, newTab = false) => {
    if (entry.action === 'copy-email') {
      navigator.clipboard?.writeText(EMAIL);
      setCopied(true);
      setTimeout(hide, 700);
      return;
    }
    if (entry.action === 'roll-theme') {
      const safe = document.documentElement.classList.contains('hp-a11y');
      const current = localStorage.getItem('hp-theme');
      const pool = (safe ? SAFE_THEME_NAMES : MT_THEMES.map((t) => t.name)).filter((n) => n !== current);
      const next = pool[Math.floor(Math.random() * pool.length)];
      localStorage.setItem('hp-theme', next);
      applyThemeVars(next);
      // Chrome that tracks the theme in React state listens for this.
      window.dispatchEvent(new CustomEvent('hp:theme', { detail: next }));
      return;
    }
    if (!entry.href) return;
    if (entry.external || newTab) window.open(entry.href, '_blank', 'noopener');
    else window.location.href = entry.href;
    hide();
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); run(results[active], e.metaKey || e.ctrlKey); }
    else if (e.key === 'Escape') { e.preventDefault(); hide(); }
  };

  let lastGroup: Group | null = null;

  return (
    <>
      <button onClick={show} className="hp-glass-pill hp-cmdk-trigger" aria-label="search (⌘K)">
        <MagnifyingGlass size={15} weight="bold" />
        <span className="hp-cmdk-trigger-keys">⌘K</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="cmdk"
            className="hp-cmdk-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) hide(); }}
          >
            <motion.div
              className="hp-cmdk"
              role="dialog"
              aria-label="search"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            >
              <div className="hp-cmdk-input-row">
                <MagnifyingGlass size={20} className="hp-cmdk-dim" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder="Search everything…"
                  spellCheck={false}
                  aria-controls="hp-cmdk-list"
                  aria-activedescendant={results[active] ? `hp-cmdk-${results[active].id}` : undefined}
                />
                <button onClick={hide} className="hp-cmdk-kbd">esc</button>
              </div>
              <div ref={listRef} id="hp-cmdk-list" role="listbox" className="hp-cmdk-list">
                {results.length === 0 && (
                  <div className="hp-cmdk-empty">
                    {index.length ? <>Nothing for “{query}”.</> : 'Loading…'}
                  </div>
                )}
                {results.map((entry, i) => {
                  const heading = entry.group !== lastGroup ? GROUP_LABEL[entry.group] : null;
                  lastGroup = entry.group;
                  const isCopied = entry.action === 'copy-email' && copied;
                  return (
                    <div key={entry.id}>
                      {heading && <div className="hp-cmdk-group">{heading}</div>}
                      <div
                        id={`hp-cmdk-${entry.id}`}
                        role="option"
                        aria-selected={i === active}
                        data-idx={i}
                        className="hp-cmdk-item"
                        onMouseMove={() => { if (i !== active) setActive(i); }}
                        onClick={(e) => run(entry, e.metaKey || e.ctrlKey)}
                      >
                        <span className="hp-cmdk-icon">{isCopied ? <Check size={ICON_SIZE} /> : entry.icon}</span>
                        <span className="hp-cmdk-text">
                          <span className="hp-cmdk-title">{entry.title}{entry.external ? ' ↗' : ''}</span>
                          {(entry.sub || isCopied) && <span className="hp-cmdk-sub">{isCopied ? 'Copied to clipboard' : entry.sub}</span>}
                        </span>
                        <span className="hp-cmdk-chip">{entry.chip}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hp-cmdk-footer">
                <span><kbd className="hp-cmdk-kbd">↑↓</kbd> navigate</span>
                <span><kbd className="hp-cmdk-kbd">↵</kbd> select</span>
                <span className="hp-cmdk-hint">try “carvana” or “fly fishing”</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
