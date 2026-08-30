import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent, DragEvent as ReactDragEvent } from 'react';
import { useDialKitController } from 'dialkit';

/* ---------------- types ---------------- */

interface Pt { x: number; y: number }
interface ViewBox { x: number; y: number; w: number; h: number }
interface Src { name: string; w: number; h: number; canvas: HTMLCanvasElement; data: ImageData }

/* ---------------- helpers ---------------- */

const U = 24; // preview units per cell
const MAX_CELLS = 512;
const MAX_RASTER = 16000; // canvas dimension safety cap

const pad = (vb: ViewBox, f: number): ViewBox =>
  ({ x: vb.x - vb.w * f, y: vb.y - vb.h * f, w: vb.w * (1 + 2 * f), h: vb.h * (1 + 2 * f) });

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

// If the PNG is pixel art that's been scaled up by an integer factor, every
// color boundary lands on a multiple of that factor — the gcd recovers it.
function detectScale(d: ImageData): number {
  const { width: w, height: h, data } = d;
  let gx = w;
  for (let x = 1; x < w && gx > 1; x++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4, j = i - 4;
      if (data[i] !== data[j] || data[i + 1] !== data[j + 1] || data[i + 2] !== data[j + 2] || data[i + 3] !== data[j + 3]) {
        gx = gcd(gx, x);
        break;
      }
    }
  }
  let gy = h;
  for (let y = 1; y < h && gy > 1; y++) {
    const row = y * w * 4, prev = row - w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4, j = prev + x * 4;
      if (data[i] !== data[j] || data[i + 1] !== data[j + 1] || data[i + 2] !== data[j + 2] || data[i + 3] !== data[j + 3]) {
        gy = gcd(gy, y);
        break;
      }
    }
  }
  const s = gcd(gx, gy);
  return s >= 2 && w / s >= 4 && h / s >= 4 ? s : 1;
}

function avgLum(d: ImageData) {
  const { data } = d;
  let lum = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 8) continue;
    lum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    n++;
  }
  return n ? lum / n / 255 : null;
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------- palette (shared with the dimension tool) ---------------- */

const INK = '#1B1D22';
const CHROME_TXT = '#E8E6DD';
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const THEMES = {
  light: { canvas: '#F3F2EC', dot: '#D8D6CC', ink: '#1B1D22', pick: '#0E7C86' },
  dark: { canvas: '#14161B', dot: '#2A2E37', ink: '#E8E6DD', pick: '#3DD6C3' },
} as const;

type ThemeKey = keyof typeof THEMES;

const LINE_DARK = '#1B1D22';
const LINE_LIGHT = '#F5F4EE';

/* ---------------- component ---------------- */

export default function GridbitTool() {
  const [src, setSrc] = useState<Src | null>(null);
  const [view, setView] = useState<ViewBox | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; view: ViewBox; upx: number } | null>(null);
  const viewRef = useRef<ViewBox | null>(null);
  viewRef.current = view;

  /* ---------- DialKit panel ---------- */
  const onActionRef = useRef<(path: string) => void>(() => {});
  const dial = useDialKitController('Gridbit', {
    grid: {
      cols: { type: 'text', default: '', placeholder: 'auto' },
      rows: { type: 'text', default: '', placeholder: 'auto' },
      linked: true,
    },
    lines: {
      majorEvery: [10, 0, 50, 1] as [number, number, number, number],
      numbers: true,
    },
    output: {
      _collapsed: true,
      cellSize: [32, 8, 128, 1] as [number, number, number, number],
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
      minorColor: '#1B1D22',
      majorColor: '#1B1D22',
      minorOpacity: [40, 10, 100, 5] as [number, number, number, number],
    },
    loadPng: { type: 'action', label: 'Load PNG…' },
    fitView: { type: 'action', label: 'Fit View' },
    exportPng: { type: 'action', label: 'Export PNG' },
    exportJpeg: { type: 'action', label: 'Export JPEG' },
    exportSvg: { type: 'action', label: 'Export SVG' },
  }, {
    id: 'gridbit',
    onAction: (path) => onActionRef.current(path),
  });

  const colsStr = dial.values.grid.cols;
  const rowsStr = dial.values.grid.rows;
  const linked = dial.values.grid.linked;
  const majorEvery = Math.round(dial.values.lines.majorEvery);
  const numbers = dial.values.lines.numbers;
  const cellSize = Math.round(dial.values.output.cellSize);
  const themeKey = dial.values.look.canvas as ThemeKey;
  const autoColors = dial.values.look.autoColors;
  const minorOpacity = dial.values.look.minorOpacity / 100;

  const T = THEMES[themeKey];

  const clampCells = (v: number) => Math.max(1, Math.min(MAX_CELLS, Math.round(v)));
  const parseCells = (s: string, fallback: number) => {
    const v = parseInt(s, 10);
    return isFinite(v) && v > 0 ? clampCells(v) : fallback;
  };
  const cols = src ? parseCells(colsStr, clampCells(src.w)) : 0;
  const rows = src ? parseCells(rowsStr, clampCells(src.h)) : 0;

  /* ---------- aspect link ---------- */
  const prevGrid = useRef({ cols: colsStr, rows: rowsStr });
  useEffect(() => {
    const prev = prevGrid.current;
    prevGrid.current = { cols: colsStr, rows: rowsStr };
    if (!src || !linked) return;
    if (colsStr !== prev.cols) {
      const c = parseInt(colsStr, 10);
      if (isFinite(c) && c > 0) {
        const nr = String(clampCells((clampCells(c) * src.h) / src.w));
        if (nr !== rowsStr) dial.setValues({ grid: { rows: nr } });
      }
    } else if (rowsStr !== prev.rows) {
      const r = parseInt(rowsStr, 10);
      if (isFinite(r) && r > 0) {
        const nc = String(clampCells((clampCells(r) * src.w) / src.h));
        if (nc !== colsStr) dial.setValues({ grid: { cols: nc } });
      }
    }
  }, [colsStr, rowsStr]);

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
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { setError("That image couldn't be decoded."); return; }
      if (w * h > 16_000_000) { setError('That image is too large — keep it under ~16 megapixels.'); return; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      let data: ImageData;
      try {
        data = ctx.getImageData(0, 0, w, h);
      } catch {
        setError("Couldn't read pixels from that image.");
        return;
      }
      const scale = detectScale(data);
      const c0 = clampCells(w / scale), r0 = clampCells(h / scale);
      const lum = avgLum(data);
      dial.setValues({ grid: { cols: String(c0), rows: String(r0) } });
      if (lum != null) dial.setValues({ look: { canvas: lum > 0.6 ? 'dark' : 'light' } });
      prevGrid.current = { cols: String(c0), rows: String(r0) };
      const m = U * 1.6;
      setView(pad({ x: -m, y: -m, w: c0 * U + 2 * m, h: r0 * U + 2 * m }, 0.04));
      setSrc({ name: file.name.replace(/\.[a-z]+$/i, '') || 'pixels', w, h, canvas, data });
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError("That file couldn't be read as an image."); };
    img.src = url;
  }

  /* ---------- downsample to the grid ---------- */
  const small = useMemo(() => {
    if (!src || !cols || !rows) return null;
    const c = document.createElement('canvas');
    c.width = cols; c.height = rows;
    const ctx = c.getContext('2d')!;
    if (cols === src.w && rows === src.h) {
      ctx.drawImage(src.canvas, 0, 0);
    } else {
      const out = ctx.createImageData(cols, rows);
      const sd = src.data.data, od = out.data;
      for (let y = 0; y < rows; y++) {
        const sy = Math.min(src.h - 1, Math.floor(((y + 0.5) * src.h) / rows));
        for (let x = 0; x < cols; x++) {
          const sx = Math.min(src.w - 1, Math.floor(((x + 0.5) * src.w) / cols));
          const si = (sy * src.w + sx) * 4, oi = (y * cols + x) * 4;
          od[oi] = sd[si]; od[oi + 1] = sd[si + 1]; od[oi + 2] = sd[si + 2]; od[oi + 3] = sd[si + 3];
        }
      }
      ctx.putImageData(out, 0, 0);
    }
    return c;
  }, [src, cols, rows]);

  const smallUrl = useMemo(() => (small ? small.toDataURL('image/png') : null), [small]);
  const artLum = useMemo(
    () => (small ? avgLum(small.getContext('2d')!.getImageData(0, 0, cols, rows)) : null),
    [small]
  );

  /* ---------- line colors ---------- */
  const autoTone = artLum != null && artLum < 0.5 ? LINE_LIGHT : LINE_DARK;
  const minorC = autoColors ? autoTone : dial.values.look.minorColor;
  const majorC = autoColors ? autoTone : dial.values.look.majorColor;

  /* ---------- zoom / pan ---------- */
  function clientToUser(cx: number, cy: number): Pt | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(m.inverse());
  }

  const getUpx = useCallback(() => {
    const v = viewRef.current;
    if (!v) return 1;
    return Math.max(v.w / Math.max(box.w, 1), v.h / Math.max(box.h, 1));
  }, [box]);

  const zoomAt = useCallback((clientX: number, clientY: number, f: number) => {
    const v = viewRef.current;
    const p = clientToUser(clientX, clientY);
    if (!v || !p) return;
    const w = Math.min(Math.max(v.w * f, 1), 1e7);
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
  }, [src, zoomAt, getUpx]);

  function zoomFit() {
    if (!src) return;
    const m = U * 1.6;
    setView(pad({ x: -m, y: -m, w: cols * U + 2 * m, h: rows * U + 2 * m }, 0.04));
  }

  function zoomCenter(f: number) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (!view || e.button > 1) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, view: { ...view }, upx: getUpx() };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const p = clientToUser(e.clientX, e.clientY);
    if (p) setCursor(p);
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    setView({ ...d.view, x: d.view.x - dx * d.upx, y: d.view.y - dy * d.upx });
  }

  /* ---------- shared render geometry ---------- */
  const isMajor = (i: number, n: number) =>
    i === 0 || i === n || (majorEvery > 0 && i % majorEvery === 0);

  // export cell size, capped so the canvas stays under browser limits
  const exportCell = Math.min(cellSize, Math.floor(MAX_RASTER / Math.max(cols || 1, rows || 1)));

  interface Geo {
    cell: number; m: number; W: number; H: number;
    minorW: number; majorW: number; tick: number; fs: number;
  }
  function geometry(cell: number): Geo {
    const fs = Math.max(8, Math.min(40, Math.round(cell * 0.42)));
    const m = numbers ? Math.round(cell * 0.6 + fs * 2.2) : Math.max(6, Math.round(cell * 0.4));
    return {
      cell, m,
      W: cols * cell + 2 * m,
      H: rows * cell + 2 * m,
      minorW: Math.max(1, Math.round(cell / 24)),
      majorW: Math.max(2, Math.round(cell / 12)),
      tick: Math.round(cell * 0.28),
      fs,
    };
  }

  /* ---------- raster export ---------- */
  function renderRaster(): HTMLCanvasElement | null {
    if (!small || !cols || !rows) return null;
    const g = geometry(exportCell);
    const cv = document.createElement('canvas');
    cv.width = g.W; cv.height = g.H;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = T.canvas;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, g.m, g.m, cols * g.cell, rows * g.cell);

    const line = (x: number, y: number, w: number, h: number, c: string, a: number) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      ctx.globalAlpha = 1;
    };
    for (let i = 0; i <= cols; i++) {
      const x = g.m + i * g.cell;
      if (isMajor(i, cols)) line(x - g.majorW / 2, g.m - g.tick, g.majorW, rows * g.cell + 2 * g.tick, majorC, 1);
      else line(x - g.minorW / 2, g.m, g.minorW, rows * g.cell, minorC, minorOpacity);
    }
    for (let i = 0; i <= rows; i++) {
      const y = g.m + i * g.cell;
      if (isMajor(i, rows)) line(g.m - g.tick, y - g.majorW / 2, cols * g.cell + 2 * g.tick, g.majorW, majorC, 1);
      else line(g.m, y - g.minorW / 2, cols * g.cell, g.minorW, minorC, minorOpacity);
    }

    if (numbers) {
      ctx.fillStyle = T.ink;
      ctx.textAlign = 'center';
      const font = (bold: boolean) => { ctx.font = `${bold ? 600 : 400} ${g.fs}px ${MONO}`; };
      for (let c = 1; c <= cols; c++) {
        const bold = majorEvery > 0 && c % majorEvery === 0;
        font(bold);
        const x = g.m + (c - 0.5) * g.cell;
        ctx.fillText(String(c), x, g.m - g.tick - g.fs * 0.5);
        ctx.fillText(String(c), x, g.m + rows * g.cell + g.tick + g.fs * 1.15);
      }
      for (let r = 1; r <= rows; r++) {
        const bold = majorEvery > 0 && r % majorEvery === 0;
        font(bold);
        const y = g.m + (r - 0.5) * g.cell + g.fs * 0.35;
        ctx.textAlign = 'right';
        ctx.fillText(String(r), g.m - g.tick - g.fs * 0.5, y);
        ctx.textAlign = 'left';
        ctx.fillText(String(r), g.m + cols * g.cell + g.tick + g.fs * 0.5, y);
        ctx.textAlign = 'center';
      }
    }
    return cv;
  }

  function exportRaster(kind: 'png' | 'jpeg') {
    const cv = renderRaster();
    if (!cv || !src) return;
    cv.toBlob(
      (blob) => { if (blob) download(blob, `${src.name}-chart.${kind === 'png' ? 'png' : 'jpg'}`); },
      kind === 'png' ? 'image/png' : 'image/jpeg',
      0.92
    );
  }

  /* ---------- svg export ---------- */
  function exportSvgFile() {
    if (!small || !src || !cols || !rows) return;
    const g = geometry(exportCell);
    // pre-upscale with nearest neighbor so the art stays crisp in viewers
    // that ignore image-rendering hints
    const up = document.createElement('canvas');
    up.width = cols * g.cell; up.height = rows * g.cell;
    const uctx = up.getContext('2d')!;
    uctx.imageSmoothingEnabled = false;
    uctx.drawImage(small, 0, 0, up.width, up.height);
    const href = up.toDataURL('image/png');

    const L: string[] = [];
    L.push(`<rect width="${g.W}" height="${g.H}" fill="${T.canvas}"/>`);
    L.push(`<image x="${g.m}" y="${g.m}" width="${cols * g.cell}" height="${rows * g.cell}" href="${href}" style="image-rendering:pixelated"/>`);
    const line = (x1: number, y1: number, x2: number, y2: number, w: number, c: string, a: number) =>
      L.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"${a < 1 ? ` stroke-opacity="${a}"` : ''}/>`);
    for (let i = 0; i <= cols; i++) {
      const x = g.m + i * g.cell;
      if (isMajor(i, cols)) line(x, g.m - g.tick, x, g.m + rows * g.cell + g.tick, g.majorW, majorC, 1);
      else line(x, g.m, x, g.m + rows * g.cell, g.minorW, minorC, minorOpacity);
    }
    for (let i = 0; i <= rows; i++) {
      const y = g.m + i * g.cell;
      if (isMajor(i, rows)) line(g.m - g.tick, y, g.m + cols * g.cell + g.tick, y, g.majorW, majorC, 1);
      else line(g.m, y, g.m + cols * g.cell, y, g.minorW, minorC, minorOpacity);
    }
    if (numbers) {
      const text = (x: number, y: number, s: string, anchor: string, bold: boolean) =>
        L.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${MONO.replace(/"/g, "'")}" font-size="${g.fs}" font-weight="${bold ? 600 : 400}" fill="${T.ink}">${s}</text>`);
      for (let c = 1; c <= cols; c++) {
        const bold = majorEvery > 0 && c % majorEvery === 0;
        const x = g.m + (c - 0.5) * g.cell;
        text(x, g.m - g.tick - g.fs * 0.5, String(c), 'middle', bold);
        text(x, g.m + rows * g.cell + g.tick + g.fs * 1.15, String(c), 'middle', bold);
      }
      for (let r = 1; r <= rows; r++) {
        const bold = majorEvery > 0 && r % majorEvery === 0;
        const y = g.m + (r - 0.5) * g.cell + g.fs * 0.35;
        text(g.m - g.tick - g.fs * 0.5, y, String(r), 'end', bold);
        text(g.m + cols * g.cell + g.tick + g.fs * 0.5, y, String(r), 'start', bold);
      }
    }
    const out =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.W} ${g.H}" width="${g.W}" height="${g.H}">\n${L.join('\n')}\n</svg>`;
    download(new Blob([out], { type: 'image/svg+xml' }), `${src.name}-chart.svg`);
  }

  /* ---------- dialkit actions ---------- */
  onActionRef.current = (path: string) => {
    if (path === 'loadPng') fileRef.current?.click();
    else if (path === 'fitView') zoomFit();
    else if (path === 'exportPng') exportRaster('png');
    else if (path === 'exportJpeg') exportRaster('jpeg');
    else if (path === 'exportSvg') exportSvgFile();
  };

  /* ---------- drop ---------- */
  function onDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDropping(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFile(f);
  }

  /* ---------- paste ---------- */
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            loadFileRef.current(f);
          }
          return;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  /* ---------- preview grid (in U units) ---------- */
  const previewGrid = useMemo(() => {
    if (!src || !cols || !rows) return null;
    const minorW = U / 24, majorW = U / 11, tick = U * 0.28;
    const v: ReactNode[] = [];
    for (let i = 0; i <= cols; i++) {
      const x = i * U;
      const major = isMajor(i, cols);
      v.push(
        <line
          key={`v${i}`} x1={x} y1={major ? -tick : 0} x2={x} y2={rows * U + (major ? tick : 0)}
          stroke={major ? majorC : minorC} strokeWidth={major ? majorW : minorW}
          strokeOpacity={major ? 1 : minorOpacity}
        />
      );
    }
    for (let i = 0; i <= rows; i++) {
      const y = i * U;
      const major = isMajor(i, rows);
      v.push(
        <line
          key={`h${i}`} x1={major ? -tick : 0} y1={y} x2={cols * U + (major ? tick : 0)} y2={y}
          stroke={major ? majorC : minorC} strokeWidth={major ? majorW : minorW}
          strokeOpacity={major ? 1 : minorOpacity}
        />
      );
    }
    return v;
  }, [src, cols, rows, majorEvery, majorC, minorC, minorOpacity]);

  const previewLabels = useMemo(() => {
    if (!src || !numbers || !cols || !rows) return null;
    const fs = U * 0.42, tick = U * 0.28;
    const t: ReactNode[] = [];
    const style = (bold: boolean): CSSProperties => ({
      fontFamily: MONO, fontSize: fs, fill: T.ink, fontWeight: bold ? 600 : 400, userSelect: 'none',
    });
    for (let c = 1; c <= cols; c++) {
      const bold = majorEvery > 0 && c % majorEvery === 0;
      const x = (c - 0.5) * U;
      t.push(<text key={`t${c}`} x={x} y={-tick - fs * 0.5} textAnchor="middle" style={style(bold)}>{c}</text>);
      t.push(<text key={`b${c}`} x={x} y={rows * U + tick + fs * 1.15} textAnchor="middle" style={style(bold)}>{c}</text>);
    }
    for (let r = 1; r <= rows; r++) {
      const bold = majorEvery > 0 && r % majorEvery === 0;
      const y = (r - 0.5) * U + fs * 0.35;
      t.push(<text key={`l${r}`} x={-tick - fs * 0.5} y={y} textAnchor="end" style={style(bold)}>{r}</text>);
      t.push(<text key={`r${r}`} x={cols * U + tick + fs * 0.5} y={y} textAnchor="start" style={style(bold)}>{r}</text>);
    }
    return t;
  }, [src, numbers, cols, rows, majorEvery, T.ink]);

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
  const exportGeo = src && cols && rows ? geometry(exportCell) : null;

  const cellUnder =
    cursor && src && cursor.x >= 0 && cursor.y >= 0 && cursor.x < cols * U && cursor.y < rows * U
      ? { c: Math.floor(cursor.x / U) + 1, r: Math.floor(cursor.y / U) + 1 }
      : null;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: T.canvas, color: INK, fontFamily: SANS }}>
      <input
        ref={fileRef} type="file" accept="image/png,image/gif,image/webp,image/jpeg" style={{ display: 'none' }}
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
        {/* brand chip / back to the site */}
        <a
          href="/"
          title="back to hudbud.net"
          style={{
            position: 'absolute', left: 10, top: 10, zIndex: 2,
            background: 'rgba(27,29,34,0.92)', color: CHROME_TXT,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 11px', borderRadius: 3, textDecoration: 'none',
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.65 }}>←</span>
          <div style={{ width: 11, height: 11, background: '#C8352A' }} />
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em' }}>GRIDBIT</span>
        </a>

        {src ? (
          <svg
            ref={svgRef}
            viewBox={viewBoxStr}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { setCursor(null); dragRef.current = null; }}
          >
            {smallUrl && (
              <image
                x={0} y={0} width={cols * U} height={rows * U}
                href={smallUrl} preserveAspectRatio="none"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            {previewGrid}
            {previewLabels}
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
              CHART 1 OF 1 · NO FILE LOADED
            </div>
            <div style={{ textAlign: 'center', maxWidth: 420 }}>
              <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: '0.18em', marginBottom: 10 }}>DROP OR PASTE A PNG</div>
              <div style={{ fontSize: 13.5, opacity: 0.7, lineHeight: 1.55, marginBottom: 18 }}>
                Pixel art in, crochet chart out. It guesses the true stitch dimensions (even for scaled-up art) — adjust them if it's wrong. Minor lines mark every stitch, major lines every 10, with numbered rows and columns along the edges. Export a big PNG, JPEG, or SVG to follow along on an iPad. All the knobs live in the dial panel.
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
        {src && (
          <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 4 }}>
            <button style={btn} title="Zoom out" onClick={() => zoomCenter(1.25)}>−</button>
            <button style={btn} title="Zoom in" onClick={() => zoomCenter(0.8)}>+</button>
            <button style={btn} title="Fit chart" onClick={zoomFit}>Fit</button>
          </div>
        )}

        {/* ------- status bar ------- */}
        {src && (
          <div
            style={{
              position: 'absolute', left: 10, bottom: 10,
              background: 'rgba(27,29,34,0.92)', color: CHROME_TXT,
              fontFamily: MONO, fontSize: 11, padding: '6px 10px', borderRadius: 3,
              display: 'flex', gap: 16, pointerEvents: 'none', letterSpacing: '0.02em',
              maxWidth: 'calc(100% - 220px)', flexWrap: 'wrap',
            }}
          >
            <span style={{ minWidth: 110 }}>
              {cellUnder ? `col ${cellUnder.c}  row ${cellUnder.r}` : 'col —  row —'}
            </span>
            <span style={{ color: THEMES.dark.pick }}>
              {cols}×{rows} sts
            </span>
            {exportGeo && (
              <span style={{ color: '#8B8F99' }}>
                exports {exportGeo.W}×{exportGeo.H}px{exportCell < cellSize ? ' (cell capped)' : ''} · scroll pans · pinch zooms
              </span>
            )}
          </div>
        )}
        {src && error && (
          <div style={{ position: 'absolute', right: 10, bottom: 46, fontFamily: MONO, fontSize: 11, color: '#C8352A' }}>{error}</div>
        )}
      </div>
    </div>
  );
}
