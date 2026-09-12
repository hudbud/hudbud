import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { useDialKitController } from 'dialkit';
import { ToolEmpty } from './toolTheme';

type Shape = 'circle' | 'square' | 'diamond' | 'line';

function shapePath(shape: Shape, cx: number, cy: number, r: number): string {
  if (r <= 0.05) return '';
  switch (shape) {
    case 'square': {
      const s = r * 1.13;
      return `<rect x="${(cx - s).toFixed(2)}" y="${(cy - s).toFixed(2)}" width="${(s * 2).toFixed(2)}" height="${(s * 2).toFixed(2)}"/>`;
    }
    case 'diamond': {
      const s = r * 1.5;
      return `<polygon points="${cx.toFixed(2)},${(cy - s).toFixed(2)} ${(cx + s).toFixed(2)},${cy.toFixed(2)} ${cx.toFixed(2)},${(cy + s).toFixed(2)} ${(cx - s).toFixed(2)},${cy.toFixed(2)}"/>`;
    }
    case 'line': {
      const len = r * 2.1;
      const thick = Math.max(0.6, r * 0.55);
      return `<rect x="${(cx - len / 2).toFixed(2)}" y="${(cy - thick / 2).toFixed(2)}" width="${len.toFixed(2)}" height="${thick.toFixed(2)}"/>`;
    }
    default:
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}"/>`;
  }
}

function getGrayscaleGrid(img: HTMLImageElement, cellSize: number) {
  const MAX_DIM = 900;
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const cols = Math.ceil(w / cellSize);
  const rows = Math.ceil(h / cellSize);
  const grid = new Float32Array(cols * rows);
  const counts = new Float32Array(cols * rows);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3] / 255;
      const lum = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
      const cx = Math.min(cols - 1, Math.floor(x / cellSize));
      const cy = Math.min(rows - 1, Math.floor(y / cellSize));
      const gi = cy * cols + cx;
      grid[gi] += lum * a + (1 - a);
      counts[gi] += 1;
    }
  }
  for (let i = 0; i < grid.length; i++) grid[i] = counts[i] ? grid[i] / counts[i] : 1;
  return { grid, cols, rows, w, h };
}

function buildSVG(
  img: HTMLImageElement,
  cellSize: number,
  angleDeg: number,
  maxDotFrac: number,
  gamma: number,
  invert: boolean,
  fg: string,
  transparent: boolean,
  bg: string,
  shape: Shape,
) {
  const { grid, cols, rows, w, h } = getGrayscaleGrid(img, cellSize);
  const angle = angleDeg * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const diag = Math.sqrt(w * w + h * h);
  const range = Math.ceil(diag / cellSize) + 2;
  const maxR = (cellSize / 2) * maxDotFrac;
  let shapes = '';
  let dots = 0;
  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      const u = i * cellSize;
      const v = j * cellSize;
      const x = u * cos - v * sin + w / 2;
      const y = u * sin + v * cos + h / 2;
      if (x < -cellSize || x > w + cellSize || y < -cellSize || y > h + cellSize) continue;
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / cellSize)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(y / cellSize)));
      let lum = grid[cy * cols + cx];
      if (invert) lum = 1 - lum;
      const dark = Math.pow(Math.max(0, Math.min(1, 1 - lum)), gamma);
      const r = dark * maxR;
      if (r <= 0.15) continue;
      const p = shapePath(shape, x, y, r);
      if (p) { shapes += p; dots++; }
    }
  }
  const bgRect = transparent ? '' : `<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bgRect}<g fill="${fg}">${shapes}</g></svg>`;
  return { svg, dots, w, h };
}

export default function HalftoneTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const onActionRef = useRef<(path: string) => void>(() => {});
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const dial = useDialKitController('Vector Halftone', {
    shape: {
      type: 'select',
      options: [
        { value: 'circle', label: 'Circle' },
        { value: 'square', label: 'Square' },
        { value: 'diamond', label: 'Diamond' },
        { value: 'line', label: 'Line' },
      ],
      default: 'circle',
    },
    cell: [10, 4, 30, 1] as [number, number, number, number],
    angle: [45, 0, 90, 1] as [number, number, number, number],
    maxDot: [95, 50, 100, 1] as [number, number, number, number],
    contrast: [1, 0.3, 2.5, 0.1] as [number, number, number, number],
    invert: false,
    colors: {
      dots: { type: 'color', default: '#1a1a18' },
      background: { type: 'color', default: '#f6f5f2' },
      transparent: true,
    },
    loadImage: { type: 'action', label: 'Load image…' },
    downloadSvg: { type: 'action', label: 'Download SVG' },
    resetImage: { type: 'action', label: 'Reset image' },
  }, {
    id: 'vector-halftone',
    onAction: (path) => onActionRef.current(path),
  });

  const result = useMemo(() => {
    if (!img) return null;
    return buildSVG(
      img,
      Math.round(dial.values.cell),
      dial.values.angle,
      dial.values.maxDot / 100,
      dial.values.contrast,
      dial.values.invert,
      dial.values.colors.dots,
      dial.values.colors.transparent,
      dial.values.colors.background,
      dial.values.shape as Shape,
    );
  }, [
    img,
    dial.values.cell,
    dial.values.angle,
    dial.values.maxDot,
    dial.values.contrast,
    dial.values.invert,
    dial.values.colors.dots,
    dial.values.colors.transparent,
    dial.values.colors.background,
    dial.values.shape,
  ]);

  const loadFile = useCallback((file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setError(null);
    const url = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => {
      URL.revokeObjectURL(url);
      setImg(next);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    next.onerror = () => {
      URL.revokeObjectURL(url);
      setError("That file couldn't be read as an image.");
    };
    next.src = url;
  }, []);

  const download = useCallback(() => {
    if (!result?.svg) return;
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'halftone.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files[0];
      if (file) loadFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  useEffect(() => {
    onActionRef.current = (path) => {
      if (path === 'loadImage') fileRef.current?.click();
      else if (path === 'downloadSvg') download();
      else if (path === 'resetImage') {
        setImg(null);
        setError(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
  }, [download]);

  const onWheel = (e: ReactWheelEvent) => {
    if (!img) return;
    e.preventDefault();
    const next = zoom * (1 + -e.deltaY * 0.0015);
    setZoom(Math.min(8, Math.max(0.25, next)));
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!img) return;
    drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setPan({
      x: drag.current.panX + (e.clientX - drag.current.x),
      y: drag.current.panY + (e.clientY - drag.current.y),
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-inner)', color: 'var(--fg)', position: 'relative' }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: dropping ? '2px dashed var(--fg-dim)' : 'none',
          outlineOffset: -6,
          cursor: img ? 'grab' : 'default',
        }}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => { e.preventDefault(); setDropping(false); loadFile(e.dataTransfer.files[0]); }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
      >
        {result ? (
          <div
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
            dangerouslySetInnerHTML={{ __html: result.svg }}
          />
        ) : (
          <ToolEmpty
            title="Drop an image"
            hint="It becomes vector dots."
            onChoose={() => fileRef.current?.click()}
            error={error}
          />
        )}
      </div>

      {result && (
        <div style={{ position: 'absolute', left: 16, bottom: 36, fontSize: 12, color: 'var(--fg-dim)', pointerEvents: 'none' }}>
          {result.dots.toLocaleString()} vector dots · {result.w}×{result.h}px · {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}
