import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightning } from '@phosphor-icons/react';

// Too short to be worth flashing one word at a time.
const MIN_WORDS = 120;

// Spritz-style reader: one word at a time, pivot letter pinned to a center
// line, pausing longer on long words and punctuation. Reads the page's own
// prose, so it works on any detail page.
export default function SpeedReader() {
  const [words, setWords] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const prose = document.querySelector('.prose');
    if (!prose) return;
    // Captions and headings break the flow; read paragraphs and lists only.
    const text = Array.from(prose.querySelectorAll('p, li, blockquote')).map((el) => el.textContent ?? '').join(' ');
    setWords(text.split(/\s+/).filter(Boolean));
  }, []);

  const stop = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const word = words[index];
    if (!word) { stop(); return; }
    const base = 60000 / wpm;
    const delay = /[.!?;]$/.test(word) ? base * 2 : /[,:]$/.test(word) ? base * 1.5 : word.length > 8 ? base * 1.4 : base;
    timerRef.current = window.setTimeout(() => {
      setIndex((i) => {
        if (i >= words.length - 1) { stop(); return i; }
        return i + 1;
      });
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, index, words, wpm, stop]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stop(); setOpen(false); }
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, stop]);

  if (words.length < MIN_WORDS) return null;

  const play = () => {
    if (index >= words.length - 1) setIndex(0);
    setPlaying(true);
  };
  const word = words[index] ?? '';
  const pivot = word.length <= 1 ? 0 : Math.floor(word.length / 2) - 1;
  const minutesLeft = Math.max(1, Math.round((words.length - index) / wpm));

  return (
    <>
      <button
        type="button"
        className="hp-glass-pill"
        aria-expanded={open}
        onClick={() => { if (open) stop(); else play(); setOpen(!open); }}
      >
        <Lightning size={13} weight={open ? 'fill' : 'regular'} />
        {open ? 'stop reading' : 'speed read'}
      </button>
      {open && (
        <div className="hp-speed-reader" role="region" aria-label="speed reader">
          <div className="hp-speed-word" aria-live="off">
            <span className="hp-speed-pin" />
            <span className="hp-speed-pre">{word.slice(0, pivot)}</span>
            <span className="hp-speed-pivot">{word[pivot] ?? ''}</span>
            <span className="hp-speed-post">{word.slice(pivot + 1)}</span>
          </div>
          <div className="hp-speed-controls">
            <button type="button" className="hp-speed-play" onClick={() => (playing ? stop() : play())} aria-label={playing ? 'pause' : 'play'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={words.length - 1}
              value={index}
              onChange={(e) => { stop(); setIndex(Number(e.target.value)); }}
              aria-label="position"
            />
            <select value={wpm} onChange={(e) => setWpm(Number(e.target.value))} aria-label="words per minute" className="post-spec-cell">
              {[200, 300, 400, 500, 600].map((n) => <option key={n} value={n}>{n} wpm</option>)}
            </select>
            <span className="post-spec-cell hp-speed-left">{minutesLeft} min</span>
          </div>
        </div>
      )}
    </>
  );
}
