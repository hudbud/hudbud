// A rainbow trout in the corner of the intro, three-quarters on, nosing out
// toward the viewer and the page. He's voxels on a jointed spine, drawn at
// a few dozen pixels and scaled up hard with a dark outline so he reads as
// pixel art. His head turns toward the cursor and his body bends after it,
// the tail lagging the head. Clicking him goes fishing. three.js loads on
// its own chunk.
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type * as THREE from 'three';

/** CSS pixels per drawn pixel. */
const PX = 3;
const INK = {
  back: '#5f7f35', side: '#d5ddc6', stripe: '#ef6f8f', cheek: '#f0919a', belly: '#f6f7f2',
  fin: '#9fb06c', spot: '#1d2419', eye: '#121212', glint: '#ffffff', mouth: '#3a2a26',
};
const OUTLINE = [36, 48, 31];
/** Nose to tail: length, height and width of each spine segment. */
const SEGS = [
  { l: 0.2, h: 0.3, w: 0.24 },
  { l: 0.22, h: 0.42, w: 0.3 },
  { l: 0.24, h: 0.48, w: 0.32 },
  { l: 0.24, h: 0.48, w: 0.31 },
  { l: 0.24, h: 0.41, w: 0.27 },
  { l: 0.22, h: 0.31, w: 0.21 },
  { l: 0.2, h: 0.21, w: 0.15 },
];
/** The segment the spine bends away from, front and back. */
const MID = 3;
/** Heading at rest: nose toward the camera and off to its left. */
const REST_YAW = -2.35;

export default function PixelTrout() {
  const hostRef = useRef<HTMLAnchorElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    let cleanup = () => {};
    import('three').then((THREE) => {
      const host = hostRef.current, out = canvasRef.current;
      if (dead || !host || !out) return;
      const ctx = out.getContext('2d')!;
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#7d8a6c', 1.5));
      const sun = new THREE.DirectionalLight('#fff4e0', 2.1);
      sun.position.set(-2, 3, 3);
      scene.add(sun);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
      camera.position.set(0, 0.75, 3.05);
      camera.lookAt(0, 0.02, 0);

      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mats = new Map<string, THREE.Material>();
      const mat = (c: string) => {
        if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c }));
        return mats.get(c)!;
      };
      const box = (parent: THREE.Object3D, c: string, w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
        const m = new THREE.Mesh(geo, mat(c));
        m.scale.set(w, h, d);
        m.position.set(x, y, z);
        m.rotation.z = rz;
        parent.add(m);
        return m;
      };

      // One segment's slab of fish, centered `cx` along its joint's x (nose is +x).
      const flesh = (g: THREE.Group, i: number, cx: number) => {
        const { l, h, w } = SEGS[i];
        box(g, INK.side, l, h * 0.5, w, cx, 0, 0);
        box(g, INK.back, l, h * 0.3, w * 0.92, cx, h * 0.36, 0);
        box(g, INK.belly, l, h * 0.26, w * 0.88, cx, -h * 0.36, 0);
        box(g, i === 1 ? INK.cheek : INK.stripe, l * 1.001, h * 0.14, w + 0.01, cx, h * 0.04, 0);
        if (i >= 2) {
          for (const s of [-1, 1]) {
            for (const [dx, dy] of [[-0.3, 0.3], [0.25, 0.4], [0.05, 0.2], [-0.15, -0.12]]) {
              if (dy < 0 && i < 4) continue;
              box(g, INK.spot, 0.035, 0.035, 0.01, cx + l * dx, h * dy, s * (w / 2 + 0.006));
            }
          }
          box(g, INK.spot, 0.035, 0.01, 0.035, cx + l * 0.1, h * 0.51 + 0.003, w * 0.18);
          box(g, INK.spot, 0.035, 0.01, 0.035, cx - l * 0.25, h * 0.51 + 0.003, -w * 0.2);
        }
      };

      const pivot = new THREE.Group();
      scene.add(pivot);
      flesh(pivot, MID, 0);
      // Front chain: each joint sits where the segment behind it ends.
      const front: THREE.Group[] = [];
      let parent: THREE.Object3D = pivot, at = SEGS[MID].l / 2;
      for (let i = MID - 1; i >= 0; i--) {
        const j = new THREE.Group();
        j.position.x = at;
        parent.add(j);
        flesh(j, i, SEGS[i].l / 2);
        front.push(j);
        parent = j;
        at = SEGS[i].l;
      }
      const head = front[front.length - 1];
      {
        const { l, h, w } = SEGS[0];
        box(head, INK.side, 0.07, h * 0.62, w * 0.72, l + 0.03, -0.01, 0);
        box(head, INK.back, 0.07, h * 0.2, w * 0.66, l + 0.03, h * 0.2, 0);
        box(head, INK.mouth, 0.09, 0.025, w * 0.74, l + 0.025, -h * 0.12, 0);
        for (const s of [-1, 1]) {
          box(head, INK.eye, 0.075, 0.075, 0.02, l * 0.5, h * 0.12, s * (w / 2 + 0.008));
          box(head, INK.glint, 0.025, 0.025, 0.012, l * 0.5 + 0.015, h * 0.12 + 0.018, s * (w / 2 + 0.02));
        }
      }
      // Back chain, out to the tail.
      const back: THREE.Group[] = [];
      parent = pivot;
      at = -SEGS[MID].l / 2;
      for (let i = MID + 1; i < SEGS.length; i++) {
        const j = new THREE.Group();
        j.position.x = at;
        parent.add(j);
        flesh(j, i, -SEGS[i].l / 2);
        back.push(j);
        parent = j;
        at = -SEGS[i].l;
      }
      const tail = new THREE.Group();
      tail.position.x = at;
      parent.add(tail);
      back.push(tail);
      box(tail, INK.fin, 0.08, 0.26, 0.03, -0.04, 0, 0);
      box(tail, INK.fin, 0.3, 0.14, 0.03, -0.18, 0.15, 0, -0.45);
      box(tail, INK.fin, 0.3, 0.14, 0.03, -0.18, -0.15, 0, 0.45);
      for (const [x, y] of [[-0.12, 0.12], [-0.2, 0.17], [-0.1, -0.1], [-0.19, -0.16], [-0.05, 0.03]]) {
        for (const s of [-1, 1]) box(tail, INK.spot, 0.03, 0.03, 0.01, x, y, s * 0.02);
      }
      // Fins: dorsal, adipose, pectorals, pelvics, anal.
      const seg = (i: number) => (i === MID ? pivot : i < MID ? front[MID - 1 - i] : back[i - MID - 1]);
      const segX = (i: number) => (i === MID ? 0 : i < MID ? SEGS[i].l / 2 : -SEGS[i].l / 2);
      {
        const g = seg(2), x = segX(2), { h } = SEGS[2];
        box(g, INK.fin, 0.2, 0.12, 0.03, x - 0.02, h / 2 + 0.06, 0);
        box(g, INK.fin, 0.1, 0.06, 0.03, x - 0.05, h / 2 + 0.14, 0);
        box(g, INK.spot, 0.03, 0.03, 0.035, x + 0.02, h / 2 + 0.07, 0);
      }
      {
        const g = seg(5), x = segX(5), { h } = SEGS[5];
        box(g, INK.fin, 0.07, 0.05, 0.03, x, h / 2 + 0.025, 0);
        box(g, INK.fin, 0.1, 0.07, 0.03, x, -h / 2 - 0.035, 0);
      }
      {
        const g = seg(1), x = segX(1), { h, w } = SEGS[1];
        for (const s of [-1, 1]) {
          const p = box(g, INK.fin, 0.12, 0.02, 0.07, x - 0.06, -h * 0.42, s * (w / 2 + 0.025));
          p.rotation.x = s * 0.5;
        }
      }
      {
        const g = seg(4), x = segX(4), { h, w } = SEGS[4];
        for (const s of [-1, 1]) box(g, INK.fin, 0.1, 0.07, 0.025, x, -h / 2 - 0.03, s * w * 0.25);
      }

      // Drawn small, then outlined by hand: any empty pixel touching the fish goes dark.
      let n = 0;
      const size = () => {
        n = Math.max(32, Math.min(80, Math.round(host.clientWidth / PX)));
        renderer.setSize(n, n, false);
        out.width = out.height = n;
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(host);
      const draw = () => {
        renderer.render(scene, camera);
        ctx.clearRect(0, 0, n, n);
        ctx.drawImage(renderer.domElement, 0, 0);
        const img = ctx.getImageData(0, 0, n, n), d = img.data;
        const solid = new Uint8Array(n * n);
        for (let i = 0; i < n * n; i++) solid[i] = d[i * 4 + 3] > 110 ? 1 : 0;
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const i = y * n + x;
            if (solid[i]) { d[i * 4 + 3] = 255; continue; }
            const edge = (x > 0 && solid[i - 1]) || (x < n - 1 && solid[i + 1]) || (y > 0 && solid[i - n]) || (y < n - 1 && solid[i + n]);
            if (edge) { d[i * 4] = OUTLINE[0]; d[i * 4 + 1] = OUTLINE[1]; d[i * 4 + 2] = OUTLINE[2]; d[i * 4 + 3] = 255; }
            else d[i * 4 + 3] = 0;
          }
        }
        ctx.putImageData(img, 0, 0);
      };

      let px = 0, py = 0, seen = false;
      const move = (e: PointerEvent) => { px = e.clientX; py = e.clientY; seen = true; };
      window.addEventListener('pointermove', move, { passive: true });

      // Each joint eases toward the look on its own clock: the head gets there
      // first and the tail last, so the body curves through the turn.
      const joints = [
        ...front.map((j, i) => ({ j, rate: 8 + i * 2, side: 1, wave: 0.015 })),
        ...back.map((j, i) => ({ j, rate: 7 - i, side: -1, wave: 0.035 + i * 0.03 })),
      ];
      const bend = joints.map(() => ({ y: 0, z: 0 }));
      let yaw = 0, pitch = 0, raf = 0, visible = true, last = performance.now();
      const loop = (now: number) => {
        raf = visible ? requestAnimationFrame(loop) : 0;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        let ty = 0, tp = 0;
        if (seen) {
          const r = out.getBoundingClientRect();
          const dx = px - (r.left + r.width * 0.4), dy = py - (r.top + r.height * 0.5);
          ty = Math.max(-0.9, Math.min(0.9, Math.atan2(dx, 320)));
          tp = Math.max(-0.5, Math.min(0.5, Math.atan2(-dy, 320)));
        }
        const e = (rate: number) => 1 - Math.exp(-dt * rate);
        yaw += (ty - yaw) * e(5);
        pitch += (tp - pitch) * e(5);
        pivot.rotation.set(0, REST_YAW + yaw * 0.35, pitch * 0.35);
        const t = now / 1000;
        joints.forEach((jt, i) => {
          const b = bend[i];
          b.y += (ty * 0.26 * jt.side - b.y) * e(jt.rate);
          b.z += (tp * 0.15 * jt.side - b.z) * e(jt.rate);
          const swim = reduce ? 0 : jt.wave * Math.sin(t * 3.2 - i * 0.8);
          jt.j.rotation.set(0, b.y + swim, b.z);
        });
        draw();
      };
      const io = new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
      });
      io.observe(host);
      setReady(true);
      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener('pointermove', move);
        geo.dispose();
        mats.forEach((m) => m.dispose());
        renderer.dispose();
      };
    });
    return () => { dead = true; cleanup(); };
  }, [reduce]);

  return (
    <a ref={hostRef} href="/fish" className={`hp-trout${ready ? ' is-ready' : ''}`} aria-label="Go fishing" title="go fishing">
      <canvas ref={canvasRef} aria-hidden="true" />
    </a>
  );
}
