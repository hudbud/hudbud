// The thoughts feed — a tiny guestbook Twitter. A floating glass button opens
// a centered modal with every little thought ever posted plus a composer
// anyone can use. Posts from Hudson (via the secret codeword typed as the
// name, verified server-side) render as "hudbud" with accent styling; anyone
// else who tries to type hudbud/hudson gets renamed to "guest" by the Worker.
// Data lives in D1 behind /api/thoughts (see worker/index.js); RSS at /thoughts.xml.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { ChatTeardropText, Rss, X } from '@phosphor-icons/react';
import { GLASS } from './chrome';

export interface Thought {
  id: number;
  name: string;
  body: string;
  isHudbud: boolean;
  createdAt: number;
}

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

const INPUT: CSSProperties = {
  width: '100%',
  background: 'var(--tile)',
  border: 'none',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 16, // 16px+ stops iOS Safari from zooming the page on focus
  color: 'var(--fg)',
  outline: 'none',
};

/** mm.dd.yyyy · h:mm am — same date shape the rest of the site uses. */
function formatWhen(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}.${dd}.${d.getFullYear()} · ${h}:${min} ${ampm}`;
}

/** The floating glass icon button that opens the feed. */
export function ThoughtsButton({ pos, onClick }: { pos: CSSProperties; onClick: () => void }) {
  return (
    <div style={{ position: 'fixed', zIndex: 140, ...pos }}>
      <button
        onClick={onClick}
        title="thoughts"
        aria-label="thoughts feed"
        style={{
          ...GLASS,
          width: 46, height: 46, borderRadius: 23,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg)',
        }}
      >
        <ChatTeardropText size={18} weight="fill" />
      </button>
    </div>
  );
}

function ThoughtRow({ t }: { t: Thought }) {
  return (
    <div style={{ padding: '10px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.isHudbud ? 'var(--accent)' : 'var(--fg-dim)' }}>{t.name}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-faint)', whiteSpace: 'nowrap' }}>{formatWhen(t.createdAt)}</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--fg)', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{t.body}</div>
    </div>
  );
}

export default function ThoughtsModal({ onClose }: { onClose: () => void }) {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setName(localStorage.getItem('hp-thoughts-name') ?? '');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    fetch('/api/thoughts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setThoughts(data.thoughts); setHasMore(data.hasMore); setLoadState('ready'); })
      .catch(() => setLoadState('error'));
  }, []);

  const loadOlder = useCallback(() => {
    const oldest = thoughts[thoughts.length - 1];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    fetch(`/api/thoughts?before=${oldest.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setThoughts((prev) => [...prev, ...data.thoughts]); setHasMore(data.hasMore); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [thoughts, loadingMore]);

  // Infinite scroll: pull the next page when the list nears its bottom.
  const onScroll = () => {
    const el = listRef.current;
    if (!el || !hasMore || loadingMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadOlder();
  };

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setPostError(null);
    fetch('/api/thoughts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, body: trimmed }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'post failed');
        setThoughts((prev) => [data.thought, ...prev]);
        setBody('');
        // Remember the typed name (including the codeword) for next time.
        localStorage.setItem('hp-thoughts-name', name);
        listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((e: Error) => setPostError(e.message))
      .finally(() => setPosting(false));
  };

  return (
    <motion.div
      {...OVERLAY_FADE}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <motion.div
        {...DIALOG_POP}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(480px, 100%)', height: 'min(640px, 100%)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-inner)', border: '1px solid var(--rule)', borderRadius: 14,
          boxShadow: '0 20px 80px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>thoughts</span>
            <a href="/thoughts.xml" title="RSS feed" style={{ color: 'var(--fg-faint)', display: 'inline-flex' }}>
              <Rss size={14} weight="bold" />
            </a>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{ color: 'var(--fg-dim)', display: 'inline-flex', padding: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-dim)')}
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* feed */}
        <div ref={listRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadState === 'loading' && <div style={{ color: 'var(--fg-faint)', fontSize: 13, textAlign: 'center', padding: 24 }}>loading…</div>}
          {loadState === 'error' && <div style={{ color: 'var(--fg-faint)', fontSize: 13, textAlign: 'center', padding: 24 }}>the feed is napping — try again later</div>}
          {loadState === 'ready' && thoughts.length === 0 && (
            <div style={{ color: 'var(--fg-faint)', fontSize: 13, textAlign: 'center', padding: 24 }}>nothing here yet. say the first thing.</div>
          )}
          {thoughts.map((t) => <ThoughtRow key={t.id} t={t} />)}
          {loadingMore && <div style={{ color: 'var(--fg-faint)', fontSize: 12, textAlign: 'center', padding: 8 }}>loading more…</div>}
        </div>

        {/* composer */}
        <div style={{ borderTop: '1px solid var(--rule)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="a little thought…"
            rows={2}
            maxLength={500}
            style={{ ...INPUT, resize: 'none', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="your name"
              maxLength={40}
              style={{ ...INPUT, flex: 1, minWidth: 0 }}
            />
            <button
              onClick={submit}
              disabled={posting || !body.trim()}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, flexShrink: 0,
                background: 'var(--accent)', color: 'var(--bg)',
                opacity: posting || !body.trim() ? 0.45 : 1,
              }}
            >
              {posting ? '…' : 'post'}
            </button>
          </div>
          {postError && <div style={{ color: 'var(--accent)', fontSize: 12 }}>{postError}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
