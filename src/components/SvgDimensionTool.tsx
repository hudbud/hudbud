import { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent } from 'react';
import { useDialKitController } from 'dialkit';

/* ---------------- types ---------------- */

interface Pt { x: number; y: number }
interface SnapPt extends Pt { kind: 'corner' | 'edge' | 'free' }
interface Seg { p1: Pt; p2: Pt }
interface ViewBox { x: number; y: number; w: number; h: number }
interface Doc { markup: string; rootAttrs: Record<string, string>; vb: ViewBox | null; name: string }
interface Dim { id: number; axis: 'h' | 'v'; a: Pt; b: Pt; offset: number }

type DragState =
  | { type: 'pan'; sx: number; sy: number; view: ViewBox; upx: number; moved: boolean; button: number }
  | { type: 'dim'; id: number; axis: 'h' | 'v'; startOffset: number; px: number; py: number; changed: boolean };

/* ---------------- geometry helpers ---------------- */

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function perpDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(l2);
}

function closestOnSeg(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

const segDist = (p: Pt, a: Pt, b: Pt) => dist(p, closestOnSeg(p, a, b));

// Douglas–Peucker
function simplify(pts: Pt[], tol: number) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = perpDist(pts[k], pts[i], pts[j]);
      if (d > maxD) { maxD = d; idx = k; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = true; stack.push([i, idx], [idx, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const pad = (vb: ViewBox, f: number): ViewBox =>
  ({ x: vb.x - vb.w * f, y: vb.y - vb.h * f, w: vb.w * (1 + 2 * f), h: vb.h * (1 + 2 * f) });

function parseLum(v: string) {
  if (!v || v === 'none') return null;
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map(parseFloat);
  if (parts.length >= 4 && parts[3] === 0) return null;
  return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
}

// selected-state variant of an arbitrary hex: darken light colors, lighten dark ones
function shade(hex: string) {
  const m = (hex || '#C8352A').replace('#', '');
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some((v) => isNaN(v))) return hex;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const t = lum > 0.5 ? 0 : 255, f = 0.45;
  const mix = (c: number) => Math.round(c + (t - c) * f).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

/* ---------------- palette ---------------- */

const INK = '#1B1D22';
const CHROME_TXT = '#E8E6DD';
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const THEMES = {
  light: {
    canvas: '#F3F2EC',
    dot: '#D8D6CC',
    dim: '#C8352A',
    dimSel: '#8E1F16',
    pick: '#0E7C86',
  },
  dark: {
    canvas: '#14161B',
    dot: '#2A2E37',
    dim: '#FF6B5C',
    dimSel: '#FFB3AA',
    pick: '#3DD6C3',
  },
} as const;

type ThemeKey = keyof typeof THEMES;

/* ---------------- component ---------------- */

export default function SvgDimensionTool() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [view, setView] = useState<ViewBox | null>(null);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [dims, setDims] = useState<Dim[]>([]);
  const [hoverSeg, setHoverSeg] = useState(-1);
  const [hoverSnap, setHoverSnap] = useState<SnapPt | null>(null);
  const [pendingA, setPendingA] = useState<SnapPt | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [artLum, setArtLum] = useState<number | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentRef = useRef<SVGGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef<ViewBox | null>(null);
  const idRef = useRef(1);
  const pastRef = useRef<Dim[][]>([]);
  const futureRef = useRef<Dim[][]>([]);
  const dimsRef = useRef(dims);
  viewRef.current = view;
  dimsRef.current = dims;

  /* ---------- DialKit panel ---------- */
  const onActionRef = useRef<(path: string) => void>(() => {});
  const dial = useDialKitController('SVG Dimensions', {
    tool: {
      type: 'select',
      options: [
        { value: 'edge', label: 'Edge' },
        { value: 'point', label: 'Distance' },
      ],
      default: 'edge',
    },
    axis: {
      type: 'select',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'h', label: 'Horizontal' },
        { value: 'v', label: 'Vertical' },
      ],
      default: 'auto',
    },
    measure: {
      _collapsed: true,
      unitsPer: { type: 'text', default: '1', placeholder: '1' },
      units: { type: 'text', default: 'mm', placeholder: 'mm' },
      decimals: [1, 0, 3, 1] as [number, number, number, number],
    },
    look: {
      _collapsed: true,
      canvas: {
        type: 'select',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
        default: 'light',
      },
      autoColors: true,
      dimColor: '#C8352A',
      artColor: '#1B1D22',
    },
    loadSvg: { type: 'action', label: 'Load SVG…' },
    fitView: { type: 'action', label: 'Fit View' },
    undo: { type: 'action', label: 'Undo ⌘Z' },
    redo: { type: 'action', label: 'Redo ⌘⇧Z' },
    clearAll: { type: 'action', label: 'Clear Dims' },
    exportSvg: { type: 'action', label: 'Export SVG' },
  }, {
    id: 'svg-dimension-tool',
    onAction: (path) => onActionRef.current(path),
  });

  const tool = dial.values.tool as 'edge' | 'point';
  const mode = dial.values.axis as 'auto' | 'h' | 'v';
  const scaleStr = dial.values.measure.unitsPer;
  const units = dial.values.measure.units;
  const precision = Math.round(dial.values.measure.decimals);
  const themeKey = dial.values.look.canvas as ThemeKey;
  const autoColors = dial.values.look.autoColors;
  const dimColor = autoColors ? null : dial.values.look.dimColor;
  const svgColor = autoColors ? null : dial.values.look.artColor;

  const T = THEMES[themeKey];

  const scale = (() => { const v = parseFloat(scaleStr); return isFinite(v) && v > 0 ? v : 1; })();
  const fmt = useCallback(
    (v: number) => (v * scale).toFixed(precision) + (units.trim() ? ' ' + units.trim() : ''),
    [scale, precision, units]
  );

  const getUpx = useCallback(() => {
    const v = viewRef.current;
    if (!v) return 1;
    return Math.max(v.w / Math.max(box.w, 1), v.h / Math.max(box.h, 1));
  }, [box]);

  /* ---------- container size ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ w: el.clientWidth || 800, h: el.clientHeight || 600 })
    );
    ro.observe(el);
    setBox({ w: el.clientWidth || 800, h: el.clientHeight || 600 });
    return () => ro.disconnect();
  }, []);

  /* ---------- file loading ---------- */
  function loadFile(file: File | null | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseSvg(String(reader.result), file.name);
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsText(file);
  }

  function parseSvg(text: string, name: string) {
    setError(null);
    let parsed: Document;
    try {
      parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    } catch {
      setError("That file couldn't be parsed as SVG.");
      return;
    }
    const root = parsed.querySelector('svg');
    if (!root || parsed.querySelector('parsererror')) {
      setError("That file couldn't be parsed as SVG.");
      return;
    }
    parsed.querySelectorAll('script').forEach((n) => n.remove());
    parsed.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((a) => {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      });
    });

    let vb: ViewBox | null = null;
    const vbAttr = root.getAttribute('viewBox');
    if (vbAttr) {
      const p = vbAttr.trim().split(/[\s,]+/).map(Number);
      if (p.length === 4 && p.every(isFinite) && p[2] > 0 && p[3] > 0)
        vb = { x: p[0], y: p[1], w: p[2], h: p[3] };
    }
    if (!vb) {
      const w = parseFloat(root.getAttribute('width') || '');
      const h = parseFloat(root.getAttribute('height') || '');
      if (isFinite(w) && isFinite(h) && w > 0 && h > 0) vb = { x: 0, y: 0, w, h };
    }

    const rootAttrs: Record<string, string> = {};
    const skip = /^(width|height|viewBox|xmlns|version|id|class)$/i;
    [...root.attributes].forEach((a) => {
      if (!skip.test(a.name) && !a.name.startsWith('xmlns')) rootAttrs[a.name] = a.value;
    });

    setDims([]);
    setSelected(null);
    setHoverSeg(-1);
    setHoverSnap(null);
    setPendingA(null);
    setArtLum(null);
    dial.setValues({ look: { autoColors: true } });
    idRef.current = 1;
    pastRef.current = [];
    futureRef.current = [];
    bumpHist();
    setView(vb ? pad(vb, 0.14) : null);
    setDoc({ markup: root.innerHTML, rootAttrs, vb, name: name || 'drawing.svg' });
  }

  /* ---------- edge sampling + contrast detection ---------- */
  useEffect(() => {
    if (!doc) { setSegments([]); return; }
    const raf = requestAnimationFrame(() => {
      const svg = svgRef.current, content = contentRef.current;
      if (!svg || !content) return;

      let vb = doc.vb;
      if (!vb) {
        try {
          const bb = content.getBBox();
          vb = { x: bb.x, y: bb.y, w: Math.max(bb.width, 1), h: Math.max(bb.height, 1) };
        } catch {
          vb = { x: 0, y: 0, w: 100, h: 100 };
        }
        setDoc((d) => (d ? { ...d, vb } : d));
        setView(pad(vb, 0.14));
      }

      // --- auto-contrast: sample artwork paint luminance, pick opposing canvas ---
      try {
        const all = content.querySelectorAll('*');
        let lum = 0, n = 0;
        for (let i = 0; i < all.length && i < 800; i++) {
          const cs = getComputedStyle(all[i]);
          const f = parseLum(cs.fill);
          const s = parseLum(cs.stroke);
          if (f != null) { lum += f; n++; }
          if (s != null) { lum += s; n++; }
        }
        if (n > 0) {
          const avg = lum / n;
          setArtLum(avg);
          dial.setValues({ look: { canvas: avg > 0.6 ? 'dark' : 'light' } });
        }
      } catch { /* keep current theme */ }

      const rootCTM = svg.getScreenCTM();
      if (!rootCTM) return;
      const inv = rootCTM.inverse();
      const diag = Math.hypot(vb.w, vb.h);
      const tol = diag / 900;
      const pt = svg.createSVGPoint();
      const segs: Seg[] = [];

      content.querySelectorAll<SVGGeometryElement>('path,line,rect,polyline,polygon,circle,ellipse').forEach((el) => {
        let len = 0;
        try { len = el.getTotalLength(); } catch { return; }
        if (!isFinite(len) || len <= 0) return;
        const m = el.getScreenCTM();
        if (!m) return;
        const M = inv.multiply(m);
        const step = Math.max(diag / 700, len / 400);
        const n = Math.max(8, Math.min(400, Math.ceil(len / step)));
        const raw: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          let p: DOMPoint;
          try { p = el.getPointAtLength((len * i) / n); } catch { return; }
          pt.x = p.x; pt.y = p.y;
          const q = pt.matrixTransform(M);
          raw.push({ x: q.x, y: q.y });
        }
        const jump = (len / n) * 6 + tol;
        let run: Pt[] = [raw[0]];
        const flush = () => {
          if (run.length > 1) {
            const sp = simplify(run, tol);
            for (let i = 0; i < sp.length - 1; i++) {
              if (dist(sp[i], sp[i + 1]) > tol) segs.push({ p1: sp[i], p2: sp[i + 1] });
            }
          }
        };
        for (let i = 1; i < raw.length; i++) {
          if (dist(raw[i - 1], raw[i]) > jump) { flush(); run = [raw[i]]; }
          else run.push(raw[i]);
        }
        flush();
      });

      setSegments(segs.slice(0, 8000));
    });
    return () => cancelAnimationFrame(raf);
  }, [doc && doc.markup]);

  /* ---------- shift constraint ---------- */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false); };
    const blur = () => setShiftHeld(false);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // project p onto a horizontal or vertical line through a (whichever is closer)
  function constrain(a: Pt, p: SnapPt): SnapPt {
    const c: SnapPt = Math.abs(p.x - a.x) >= Math.abs(p.y - a.y)
      ? { ...p, y: a.y }
      : { ...p, x: a.x };
    if (c.x !== p.x || c.y !== p.y) c.kind = 'free';
    return c;
  }

  /* ---------- custom artwork color ---------- */
  useEffect(() => {
    const g = contentRef.current;
    if (!g || !doc) return;
    // restore original paints, then recolor if a custom color is set
    g.innerHTML = doc.markup;
    if (svgColor) {
      g.querySelectorAll('*').forEach((el) => {
        const cs = getComputedStyle(el);
        const s = (el as SVGElement).style;
        if (cs.fill && cs.fill !== 'none') s.setProperty('fill', svgColor, 'important');
        if (cs.stroke && cs.stroke !== 'none') s.setProperty('stroke', svgColor, 'important');
      });
    }
  }, [svgColor, doc && doc.markup]);

  /* ---------- pointer → user coords ---------- */
  function clientToUser(cx: number, cy: number): Pt | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(m.inverse());
  }

  /* ---------- zoom / pan ---------- */
  const zoomAt = useCallback((clientX: number, clientY: number, f: number) => {
    const v = viewRef.current;
    const p = clientToUser(clientX, clientY);
    if (!v || !p) return;
    const w = Math.min(Math.max(v.w * f, 1e-4), 1e7);
    const fr = w / v.w;
    setView({ x: p.x - (p.x - v.x) * fr, y: p.y - (p.y - v.y) * fr, w, h: v.h * fr });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (!v) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0022));
      } else {
        const upx = getUpx();
        setView({ ...v, x: v.x + e.deltaX * upx, y: v.y + e.deltaY * upx });
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [doc, zoomAt, getUpx]);

  function zoomFit() {
    if (doc && doc.vb) setView(pad(doc.vb, 0.14));
  }

  function zoomCenter(f: number) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }

  /* ---------- picking ---------- */
  function nearestSeg(p: Pt) {
    const thresh = 10 * getUpx();
    let best = -1, bestD = thresh;
    for (let i = 0; i < segments.length; i++) {
      const d = segDist(p, segments[i].p1, segments[i].p2);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function snapPoint(p: Pt): SnapPt {
    const upx = getUpx();
    let best: SnapPt | null = null, bestD = 12 * upx;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const d1 = dist(p, s.p1), d2 = dist(p, s.p2);
      if (d1 < bestD) { bestD = d1; best = { x: s.p1.x, y: s.p1.y, kind: 'corner' }; }
      if (d2 < bestD) { bestD = d2; best = { x: s.p2.x, y: s.p2.y, kind: 'corner' }; }
    }
    if (best) return best;
    let bd = 10 * upx;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const q = closestOnSeg(p, s.p1, s.p2);
      const d = dist(p, q);
      if (d < bd) { bd = d; best = { x: q.x, y: q.y, kind: 'edge' }; }
    }
    return best || { x: p.x, y: p.y, kind: 'free' };
  }

  /* ---------- history ---------- */
  const [, setHistTick] = useState(0);
  const bumpHist = () => setHistTick((t) => t + 1);
  function pushHistory() {
    pastRef.current.push(dimsRef.current);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    bumpHist();
  }
  function undo() {
    if (!pastRef.current.length) return;
    const prev = pastRef.current.pop()!;
    futureRef.current.push(dimsRef.current);
    setDims(prev);
    setSelected((s) => (prev.some((d) => d.id === s) ? s : null));
    setPendingA(null);
    bumpHist();
  }
  function redo() {
    if (!futureRef.current.length) return;
    const next = futureRef.current.pop()!;
    pastRef.current.push(dimsRef.current);
    setDims(next);
    setSelected((s) => (next.some((d) => d.id === s) ? s : null));
    bumpHist();
  }

  /* ---------- dims ---------- */
  function placeDim(a: Pt, b: Pt) {
    if (!doc || !doc.vb) return;
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    const axis = mode === 'auto' ? (dx >= dy ? 'h' : 'v') : mode;
    const vb = doc.vb;
    const upx = getUpx();
    const lead = 30 * upx, stackGap = 24 * upx, clash = 14 * upx;
    let offset: number;

    if (axis === 'h') {
      const midY = (a.y + b.y) / 2;
      const dir = midY < vb.y + vb.h / 2 ? -1 : 1;
      const edge = dir < 0 ? Math.min(a.y, b.y) : Math.max(a.y, b.y);
      offset = edge + dir * lead;
      while (dims.some((d) => d.axis === 'h' && Math.abs(d.offset - offset) < clash))
        offset += dir * stackGap;
    } else {
      const midX = (a.x + b.x) / 2;
      const dir = midX < vb.x + vb.w / 2 ? -1 : 1;
      const edge = dir < 0 ? Math.min(a.x, b.x) : Math.max(a.x, b.x);
      offset = edge + dir * lead;
      while (dims.some((d) => d.axis === 'v' && Math.abs(d.offset - offset) < clash))
        offset += dir * stackGap;
    }

    const id = idRef.current++;
    pushHistory();
    setDims((ds) => [...ds, { id, axis, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, offset }]);
    setSelected(id);
  }

  function removeDim(id: number) {
    pushHistory();
    setDims((ds) => ds.filter((d) => d.id !== id));
    setSelected((s) => (s === id ? null : s));
  }

  /* ---------- svg pointer handlers ---------- */
  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (!view || e.button > 1) return;
    dragRef.current = {
      type: 'pan',
      sx: e.clientX, sy: e.clientY,
      view: { ...view },
      upx: getUpx(),
      moved: false,
      button: e.button,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!view) return;
    const p = clientToUser(e.clientX, e.clientY);
    if (p) setCursor(p);
    const d = dragRef.current;
    if (!d) {
      if (p && segments.length) {
        if (tool === 'edge') { setHoverSeg(nearestSeg(p)); setHoverSnap(null); }
        else { setHoverSnap(snapPoint(p)); setHoverSeg(-1); }
      }
      return;
    }
    if (d.type === 'pan') {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.moved)
        setView({ ...d.view, x: d.view.x - dx * d.upx, y: d.view.y - dy * d.upx });
    } else if (d.type === 'dim' && p) {
      d.changed = true;
      setDims((ds) =>
        ds.map((dd) =>
          dd.id === d.id
            ? { ...dd, offset: d.axis === 'h' ? d.startOffset + (p.y - d.py) : d.startOffset + (p.x - d.px) }
            : dd
        )
      );
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.type === 'dim' && !d.changed) { pastRef.current.pop(); bumpHist(); }
    if (!d || d.type !== 'pan' || d.moved || d.button !== 0) return;
    const p = clientToUser(e.clientX, e.clientY);
    if (!p) return;
    if (tool === 'edge') {
      const idx = nearestSeg(p);
      if (idx >= 0) placeDim(segments[idx].p1, segments[idx].p2);
      else setSelected(null);
    } else {
      let s = snapPoint(p);
      if (!pendingA) { setPendingA(s); setSelected(null); }
      else {
        if (e.shiftKey || shiftHeld) s = constrain(pendingA, s);
        placeDim(pendingA, s);
        setPendingA(null);
      }
    }
  }

  function onDimPointerDown(e: ReactPointerEvent<SVGLineElement>, d: Dim) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = clientToUser(e.clientX, e.clientY);
    if (!p) return;
    setSelected(d.id);
    pushHistory();
    dragRef.current = { type: 'dim', id: d.id, axis: d.axis, startOffset: d.offset, px: p.x, py: p.y, changed: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target && (e.target as HTMLElement).tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected != null) {
        e.preventDefault();
        removeDim(selected);
      }
      if (e.key === 'Escape') { setSelected(null); setPendingA(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  /* ---------- export ---------- */
  function dimString(d: Dim, upx: number) {
    const gap = 4 * upx, over = 6 * upx, ah = 9 * upx, aw = 3.2 * upx;
    const fs = 12.5 * upx, sw = 1.1 * upx, halo = 3.5 * upx;
    const c = dimC;
    const L: string[] = [];
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      L.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${sw}"/>`);
    const tri = (pts: string) => L.push(`<polygon points="${pts}" fill="${c}"/>`);
    const text = (x: number, y: number, str: string, rot: boolean) =>
      L.push(
        `<text x="${x}" y="${y}"${rot ? ` transform="rotate(-90 ${x} ${y})"` : ''} text-anchor="middle" font-family="${MONO.replace(/"/g, "'")}" font-size="${fs}" fill="${c}" stroke="${T.canvas}" stroke-width="${halo}" paint-order="stroke" stroke-linejoin="round">${str}</text>`
      );

    if (d.axis === 'h') {
      const x1 = Math.min(d.a.x, d.b.x), x2 = Math.max(d.a.x, d.b.x), y = d.offset;
      [d.a, d.b].forEach((p) => {
        const s = Math.sign(y - p.y) || 1;
        line(p.x, p.y + s * gap, p.x, y + s * over);
      });
      line(x1, y, x2, y);
      tri(`${x1},${y} ${x1 + ah},${y - aw} ${x1 + ah},${y + aw}`);
      tri(`${x2},${y} ${x2 - ah},${y - aw} ${x2 - ah},${y + aw}`);
      text((x1 + x2) / 2, y - 4.5 * upx, fmt(x2 - x1), false);
    } else {
      const y1 = Math.min(d.a.y, d.b.y), y2 = Math.max(d.a.y, d.b.y), x = d.offset;
      [d.a, d.b].forEach((p) => {
        const s = Math.sign(x - p.x) || 1;
        line(p.x + s * gap, p.y, x + s * over, p.y);
      });
      line(x, y1, x, y2);
      tri(`${x},${y1} ${x - aw},${y1 + ah} ${x + aw},${y1 + ah}`);
      tri(`${x},${y2} ${x - aw},${y2 - ah} ${x + aw},${y2 - ah}`);
      text(x - 4.5 * upx, (y1 + y2) / 2, fmt(y2 - y1), true);
    }
    return L.join('\n');
  }

  function exportSvg() {
    if (!doc || !doc.vb || !dimsRef.current.length) return;
    const upx = getUpx();
    const m = 26 * upx;
    let bx = doc.vb.x, by = doc.vb.y, bX = doc.vb.x + doc.vb.w, bY = doc.vb.y + doc.vb.h;
    dimsRef.current.forEach((d) => {
      if (d.axis === 'h') { by = Math.min(by, d.offset - m); bY = Math.max(bY, d.offset + m); }
      else { bx = Math.min(bx, d.offset - m); bX = Math.max(bX, d.offset + m); }
    });
    bx -= m; by -= m; bX += m; bY += m;
    const body = dimsRef.current.map((d) => dimString(d, upx)).join('\n');
    const art = svgColor && contentRef.current ? contentRef.current.innerHTML : doc.markup;
    const out =
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${bx} ${by} ${bX - bx} ${bY - by}">\n` +
      `<rect x="${bx}" y="${by}" width="${bX - bx}" height="${bY - by}" fill="${T.canvas}"/>\n` +
      `<g${needsInvert ? ` style="filter:invert(1) hue-rotate(180deg)"` : ''}>${art}</g>\n<g>${body}</g>\n</svg>`;
    const blob = new Blob([out], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = doc.name.replace(/\.svg$/i, '') + '-dims.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- dialkit actions ---------- */
  onActionRef.current = (path: string) => {
    if (path === 'loadSvg') fileRef.current?.click();
    else if (path === 'fitView') zoomFit();
    else if (path === 'undo') undo();
    else if (path === 'redo') redo();
    else if (path === 'clearAll') {
      if (dimsRef.current.length) { pushHistory(); setDims([]); setSelected(null); }
    }
    else if (path === 'exportSvg') exportSvg();
  };

  /* ---------- drop ---------- */
  function onDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropping(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  }

  /* ---------- render helpers ---------- */
  const upx = view ? Math.max(view.w / Math.max(box.w, 1), view.h / Math.max(box.h, 1)) : 1;
  // artwork adapts to the canvas: if its paints would vanish against the
  // current background, invert lightness (hue-rotate keeps colors sane).
  // A custom artwork color is explicit, so it's never auto-inverted.
  const needsInvert =
    !svgColor && artLum != null && (themeKey === 'light' ? artLum > 0.55 : artLum < 0.45);
  const artFilter = needsInvert ? 'invert(1) hue-rotate(180deg)' : 'none';
  const dimC = dimColor || T.dim;
  const dimSelC = dimColor ? shade(dimColor) : T.dimSel;
  const hovered = hoverSeg >= 0 ? segments[hoverSeg] : null;
  const selectedDim = dims.find((d) => d.id === selected) || null;

  // live preview values for the two-point tool
  const rawB = tool === 'point' && pendingA ? (hoverSnap || (cursor ? { ...cursor, kind: 'free' as const } : null)) : null;
  const previewB = rawB && shiftHeld && pendingA ? constrain(pendingA, rawB) : rawB;
  const snapDisplay =
    hoverSnap && pendingA && shiftHeld ? constrain(pendingA, hoverSnap) : hoverSnap;
  let previewLabel: string | null = null;
  if (pendingA && previewB) {
    const dx = Math.abs(previewB.x - pendingA.x), dy = Math.abs(previewB.y - pendingA.y);
    const axis = mode === 'auto' ? (dx >= dy ? 'h' : 'v') : mode;
    previewLabel = (axis === 'h' ? 'ΔX ' : 'ΔY ') + fmt(axis === 'h' ? dx : dy);
  }

  function SnapMarker({ p, active }: { p: SnapPt; active?: boolean }) {
    const r = 4.5 * upx;
    return (
      <g pointerEvents="none">
        {p.kind === 'corner' ? (
          <rect x={p.x - r} y={p.y - r} width={2 * r} height={2 * r} fill="none" stroke={T.pick} strokeWidth={1.4 * upx} />
        ) : (
          <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={T.pick} strokeWidth={1.4 * upx} strokeDasharray={p.kind === 'free' ? `${2 * upx} ${2 * upx}` : 'none'} />
        )}
        {active && <circle cx={p.x} cy={p.y} r={1.6 * upx} fill={T.pick} />}
      </g>
    );
  }

  function DimGlyph({ d }: { d: Dim }) {
    const isSel = d.id === selected;
    const c = isSel ? dimSelC : dimC;
    const gap = 4 * upx, over = 6 * upx, ah = 9 * upx, aw = 3.2 * upx;
    const fs = 12.5 * upx, halo = 3.5 * upx;
    const grabW = 14 * upx;
    const common = { stroke: c, strokeWidth: 1.1 * upx };
    const txt: CSSProperties = { fontFamily: MONO, fontSize: fs, fill: c, paintOrder: 'stroke', stroke: T.canvas, strokeWidth: halo, strokeLinejoin: 'round', userSelect: 'none' };

    if (d.axis === 'h') {
      const x1 = Math.min(d.a.x, d.b.x), x2 = Math.max(d.a.x, d.b.x), y = d.offset;
      return (
        <g>
          {[d.a, d.b].map((p, i) => {
            const s = Math.sign(y - p.y) || 1;
            return <line key={i} x1={p.x} y1={p.y + s * gap} x2={p.x} y2={y + s * over} {...common} />;
          })}
          <line x1={x1} y1={y} x2={x2} y2={y} {...common} />
          <polygon points={`${x1},${y} ${x1 + ah},${y - aw} ${x1 + ah},${y + aw}`} fill={c} />
          <polygon points={`${x2},${y} ${x2 - ah},${y - aw} ${x2 - ah},${y + aw}`} fill={c} />
          <text x={(x1 + x2) / 2} y={y - 4.5 * upx} textAnchor="middle" style={txt}>
            {fmt(x2 - x1)}
          </text>
          <line
            x1={x1 - ah} y1={y} x2={x2 + ah} y2={y}
            stroke="transparent" strokeWidth={grabW}
            style={{ cursor: 'ns-resize' }}
            onPointerDown={(e) => onDimPointerDown(e, d)}
          />
        </g>
      );
    }
    const y1 = Math.min(d.a.y, d.b.y), y2 = Math.max(d.a.y, d.b.y), x = d.offset;
    const tx = x - 4.5 * upx, ty = (y1 + y2) / 2;
    return (
      <g>
        {[d.a, d.b].map((p, i) => {
          const s = Math.sign(x - p.x) || 1;
          return <line key={i} x1={p.x + s * gap} y1={p.y} x2={x + s * over} y2={p.y} {...common} />;
        })}
        <line x1={x} y1={y1} x2={x} y2={y2} {...common} />
        <polygon points={`${x},${y1} ${x - aw},${y1 + ah} ${x + aw},${y1 + ah}`} fill={c} />
        <polygon points={`${x},${y2} ${x - aw},${y2 - ah} ${x + aw},${y2 - ah}`} fill={c} />
        <text x={tx} y={ty} textAnchor="middle" transform={`rotate(-90 ${tx} ${ty})`} style={txt}>
          {fmt(y2 - y1)}
        </text>
        <line
          x1={x} y1={y1 - ah} x2={x} y2={y2 + ah}
          stroke="transparent" strokeWidth={grabW}
          style={{ cursor: 'ew-resize' }}
          onPointerDown={(e) => onDimPointerDown(e, d)}
        />
      </g>
    );
  }

  /* ---------- UI bits ---------- */
  const btn: CSSProperties = {
    background: 'rgba(27,29,34,0.92)',
    color: CHROME_TXT,
    border: '1px solid #3A3D45',
    borderRadius: 3,
    padding: '5px 10px',
    fontFamily: MONO,
    fontSize: 11.5,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
  const btnPrimary: CSSProperties = { ...btn, background: '#C8352A', border: '1px solid #C8352A', color: '#FFF' };

  const viewBoxStr = view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 100 100';

  const hint =
    tool === 'edge'
      ? 'click edge to add · drag dim to move · ⌫ deletes · ⌘Z undo'
      : pendingA
        ? 'click second point · ⇧ locks to axis · esc cancels'
        : 'click first point · snaps to corners + edges';

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: T.canvas, color: INK, fontFamily: SANS }}>
      <input
        ref={fileRef} type="file" accept=".svg,image/svg+xml" style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files && e.target.files[0]); e.target.value = ''; }}
      />

      {/* ------- canvas ------- */}
      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          backgroundColor: T.canvas,
          backgroundImage: `radial-gradient(circle, ${T.dot} 1px, transparent 1px)`,
          backgroundSize: '22px 22px',
          outline: dropping ? `2px dashed ${T.pick}` : 'none',
          outlineOffset: -6,
        }}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        {/* brand chip */}
        <div
          style={{
            position: 'absolute', left: 10, top: 10, zIndex: 2,
            background: 'rgba(27,29,34,0.92)', color: CHROME_TXT,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 11px', borderRadius: 3, pointerEvents: 'none',
          }}
        >
          <div style={{ width: 11, height: 11, background: '#C8352A' }} />
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em' }}>DIMENSION</span>
        </div>

        {doc ? (
          <svg
            ref={svgRef}
            viewBox={viewBoxStr}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => { setHoverSeg(-1); setHoverSnap(null); setCursor(null); }}
          >
            <g ref={contentRef} {...doc.rootAttrs} style={{ filter: artFilter }} dangerouslySetInnerHTML={{ __html: doc.markup }} />

            {/* hover pick: edge tool */}
            {hovered && !dragRef.current && (
              <g pointerEvents="none">
                <line
                  x1={hovered.p1.x} y1={hovered.p1.y} x2={hovered.p2.x} y2={hovered.p2.y}
                  stroke={T.pick} strokeWidth={3 * upx} strokeLinecap="round" opacity={0.85}
                />
                <circle cx={hovered.p1.x} cy={hovered.p1.y} r={2.6 * upx} fill={T.pick} />
                <circle cx={hovered.p2.x} cy={hovered.p2.y} r={2.6 * upx} fill={T.pick} />
              </g>
            )}

            {/* two-point tool: anchor + snap + rubber band */}
            {tool === 'point' && pendingA && <SnapMarker p={pendingA} active />}
            {tool === 'point' && snapDisplay && !dragRef.current && <SnapMarker p={snapDisplay} />}
            {pendingA && previewB && (
              <g pointerEvents="none">
                <line
                  x1={pendingA.x} y1={pendingA.y} x2={previewB.x} y2={previewB.y}
                  stroke={T.pick} strokeWidth={1 * upx} strokeDasharray={`${4 * upx} ${3 * upx}`}
                />
                <text
                  x={(pendingA.x + previewB.x) / 2}
                  y={(pendingA.y + previewB.y) / 2 - 8 * upx}
                  textAnchor="middle"
                  style={{ fontFamily: MONO, fontSize: 11.5 * upx, fill: T.pick, paintOrder: 'stroke', stroke: T.canvas, strokeWidth: 3.5 * upx, strokeLinejoin: 'round', userSelect: 'none' }}
                >
                  {previewLabel}
                </text>
              </g>
            )}

            {dims.map((d) => <DimGlyph key={d.id} d={d} />)}
          </svg>
        ) : (
          <div
            style={{
              position: 'absolute', inset: 24, border: `1.5px solid ${themeKey === 'light' ? INK : CHROME_TXT}`,
              color: themeKey === 'light' ? INK : CHROME_TXT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ position: 'absolute', right: 0, bottom: 0, borderTop: `1.5px solid currentColor`, borderLeft: `1.5px solid currentColor`, padding: '8px 14px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', opacity: 0.55 }}>
              SHEET 1 OF 1 · NO FILE LOADED
            </div>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.18em', marginBottom: 10 }}>DROP AN SVG HERE</div>
              <div style={{ fontSize: 13.5, opacity: 0.7, lineHeight: 1.55, marginBottom: 18 }}>
                Click an edge to dimension it, or use the Distance tool to measure between any two points. Drag a dimension line to move it along its axis. Scroll pans, pinch zooms. All the knobs live in the dial panel.
              </div>
              <button
                style={{ ...btnPrimary, fontSize: 12, padding: '8px 16px' }}
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </button>
              {error && <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 11.5, color: '#C8352A' }}>{error}</div>}
            </div>
          </div>
        )}

        {/* ------- zoom cluster ------- */}
        {doc && (
          <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 4 }}>
            {selectedDim && (
              <button style={btn} title="Delete selected dimension (⌫)" onClick={() => removeDim(selectedDim.id)}>Delete dim</button>
            )}
            <button style={btn} title="Zoom out" onClick={() => zoomCenter(1.25)}>−</button>
            <button style={btn} title="Zoom in" onClick={() => zoomCenter(0.8)}>+</button>
            <button style={btn} title="Fit drawing" onClick={zoomFit}>Fit</button>
          </div>
        )}

        {/* ------- status bar ------- */}
        {doc && (
          <div
            style={{
              position: 'absolute', left: 10, bottom: 10,
              background: 'rgba(27,29,34,0.92)', color: CHROME_TXT,
              fontFamily: MONO, fontSize: 11, padding: '6px 10px', borderRadius: 3,
              display: 'flex', gap: 16, pointerEvents: 'none', letterSpacing: '0.02em',
              maxWidth: 'calc(100% - 220px)', flexWrap: 'wrap',
            }}
          >
            <span style={{ minWidth: 150 }}>
              {cursor ? `X ${(cursor.x * scale).toFixed(precision)}  Y ${(cursor.y * scale).toFixed(precision)}` : 'X —  Y —'}
            </span>
            <span style={{ color: THEMES.dark.pick, minWidth: 120 }}>
              {tool === 'edge'
                ? hovered ? `edge ${fmt(dist(hovered.p1, hovered.p2))}` : 'no edge'
                : previewLabel || (hoverSnap ? hoverSnap.kind : '—')}
            </span>
            <span style={{ color: '#8B8F99' }}>
              {dims.length} dim{dims.length === 1 ? '' : 's'} · {hint}
            </span>
          </div>
        )}
        {doc && error && (
          <div style={{ position: 'absolute', right: 10, bottom: 46, fontFamily: MONO, fontSize: 11, color: T.dim }}>{error}</div>
        )}
      </div>
    </div>
  );
}
