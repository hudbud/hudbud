import { useEffect, useRef, useState, useCallback } from 'react';

interface GraphPost {
  slug: string;
  title: string;
  tag: string;
  featureImage?: string;
  images: string[];
}

interface PostNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  slug: string;
  title: string;
  tag: string;
  featureImage?: string;
  images: string[];
  img: HTMLImageElement | null;
  imgT: number;       // image fade-in 0..1
  hoverT: number;     // hover ease 0..1
  breathePhase: number;
  breatheSpeed: number;
  restScale: number;  // per-node spring length variance (organic clusters)
}

interface HubNode {
  tag: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number;
  anchorY: number;
  restLen: number;    // spring rest length to member posts
}

interface ChildNode {
  src: string;
  img: HTMLImageElement | null;
  imgT: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornT: number;      // spawn ease 0..1 (alpha + scale only; motion is physics)
  hoverT: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  parallax: number;
  phase: number;
}

const TAG_COLORS: Record<string, string> = {
  work: '#e8a838',
  thoughts: '#7ec8e3',
  life: '#82c97a',
  archive: '#b8b8b8',
  resources: '#d4a5d4',
};

const POST_RADIUS = 30;
const NODE_GAP = 16;
const CHILD_RADIUS = 22;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ---- physics tuning ----
const SUB_STEP = 1 / 120;          // fixed simulation timestep (s)
const MAX_FRAME_DT = 0.05;         // cap so rAF stalls can't explode the sim
const REPULSE_POST = 140_000;      // post <-> post
const REPULSE_HUB = 320_000;       // hub <-> hub
const REPULSE_ROOT = 200_000;      // root keeps the center clear
const SPRING_POST = 5;             // post -> its hub
const SPRING_HUB = 8;              // hub -> its anchor
const DAMPING = 2.6;               // 1/s
const MAX_VEL = 600;
const CHILD_REPULSE = 26_000;
const CHILD_SPRING = 9;
const CHILD_DAMPING = 4.5;
const CHILD_MAX_VEL = 900;

// Deterministic PRNG so the layout is identical on every visit
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Draw an image into a circle using cover-fit (no aspect distortion). */
function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number) {
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - s) / 2;
  const sy = (img.naturalHeight - s) / 2;
  ctx.drawImage(img, sx, sy, s, s, cx - r, cy - r, r * 2, r * 2);
}

function loadInto(target: { img: HTMLImageElement | null }, src: string) {
  const el = new Image();
  el.crossOrigin = 'anonymous';
  el.decoding = 'async';
  el.onload = () => { target.img = el; };
  el.src = src;
}

/**
 * One fixed-timestep tick of the main graph simulation.
 * Posts repel every other post and every hub; each post is tethered to its
 * hub by a spring; hubs repel each other and are anchored in place.
 */
function stepGraph(
  nodes: PostNode[],
  hubs: Map<string, HubNode>,
  h: number,
  time: number,
  grabbed: PostNode | null,
  breathe: boolean,
) {
  const damp = Math.exp(-DAMPING * h);
  const hubList = [...hubs.values()];

  // post <-> post repulsion
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = 1; dy = 0; d2 = 1; }
      if (d2 > 360_000) continue; // > 600 apart: negligible
      const d = Math.sqrt(d2);
      const f = Math.min(REPULSE_POST / d2, 4000);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx -= fx * h; a.vy -= fy * h;
      b.vx += fx * h; b.vy += fy * h;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];

    // spring to own hub, mild repulsion from every hub and the root
    for (let k = 0; k < hubList.length; k++) {
      const hub = hubList[k];
      let dx = hub.x - n.x, dy = hub.y - n.y;
      let d = Math.hypot(dx, dy) || 1;
      if (hub.tag === n.tag) {
        const f = SPRING_POST * (d - hub.restLen * n.restScale);
        n.vx += (dx / d) * f * h; n.vy += (dy / d) * f * h;
        hub.vx -= (dx / d) * f * h * 0.15; hub.vy -= (dy / d) * f * h * 0.15;
      } else {
        const f = Math.min(REPULSE_HUB / (d * d), 3000);
        n.vx -= (dx / d) * f * h; n.vy -= (dy / d) * f * h;
      }
    }

    // root repulsion keeps the middle open
    {
      const d = Math.hypot(n.x, n.y) || 1;
      const f = Math.min(REPULSE_ROOT / (d * d), 3000);
      n.vx += (n.x / d) * f * h; n.vy += (n.y / d) * f * h;
    }

    // gentle breathing so the web never goes fully still
    if (breathe) {
      n.vx += Math.sin(time * n.breatheSpeed + n.breathePhase) * 14 * h;
      n.vy += Math.cos(time * n.breatheSpeed * 1.3 + n.breathePhase * 1.7) * 14 * h;
    }

    if (n === grabbed) continue; // grabbed node is driven by the cursor
    n.vx *= damp; n.vy *= damp;
    const v = Math.hypot(n.vx, n.vy);
    if (v > MAX_VEL) { n.vx = (n.vx / v) * MAX_VEL; n.vy = (n.vy / v) * MAX_VEL; }
    n.x += n.vx * h;
    n.y += n.vy * h;
  }

  // hubs: mutual repulsion + anchor spring
  for (let i = 0; i < hubList.length; i++) {
    const a = hubList[i];
    for (let j = i + 1; j < hubList.length; j++) {
      const b = hubList[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = Math.min(REPULSE_HUB / (d * d), 2000);
      a.vx -= (dx / d) * f * h; a.vy -= (dy / d) * f * h;
      b.vx += (dx / d) * f * h; b.vy += (dy / d) * f * h;
    }
    a.vx += (a.anchorX - a.x) * SPRING_HUB * h;
    a.vy += (a.anchorY - a.y) * SPRING_HUB * h;
    a.vx *= damp; a.vy *= damp;
    a.x += a.vx * h;
    a.y += a.vy * h;
  }
}

/** Expanded-post images: repel each other, tethered to the parent. */
function stepChildren(children: ChildNode[], parent: PostNode, restLen: number, h: number) {
  const damp = Math.exp(-CHILD_DAMPING * h);
  for (let i = 0; i < children.length; i++) {
    const a = children[i];
    for (let j = i + 1; j < children.length; j++) {
      const b = children[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.sin(i * 7 + j); dy = Math.cos(i * 3 + j); d2 = 1; }
      if (d2 > 90_000) continue;
      const d = Math.sqrt(d2);
      const f = Math.min(CHILD_REPULSE / d2, 5000);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx -= fx * h; a.vy -= fy * h;
      b.vx += fx * h; b.vy += fy * h;
    }

    const dx = parent.x - a.x, dy = parent.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const f = CHILD_SPRING * (d - restLen);
    a.vx += (dx / d) * f * h;
    a.vy += (dy / d) * f * h;

    a.vx *= damp; a.vy *= damp;
    const v = Math.hypot(a.vx, a.vy);
    if (v > CHILD_MAX_VEL) { a.vx = (a.vx / v) * CHILD_MAX_VEL; a.vy = (a.vy / v) * CHILD_MAX_VEL; }
    a.x += a.vx * h;
    a.y += a.vy * h;
  }
}

export default function ImageGraph({ posts }: { posts: GraphPost[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<PostNode[]>([]);
  const hubsRef = useRef<Map<string, HubNode>>(new Map());
  const starsRef = useRef<Star[]>([]);
  const fitZoomRef = useRef(0);
  const extentRef = useRef(1000);

  const expandedRef = useRef<PostNode | null>(null);
  const childrenRef = useRef<ChildNode[]>([]);
  const childRestRef = useRef(110);
  const dimTRef = useRef(0); // eases to 1 while a post is expanded
  const [expandedUI, setExpandedUI] = useState(false); // HUD only

  const hoveredRef = useRef<PostNode | null>(null);
  const hoveredChildRef = useRef<number>(-1);
  const grabbedRef = useRef<PostNode | null>(null);
  const mouseRef = useRef({ sx: -9999, sy: -9999 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(0);
  const targetZoomRef = useRef(0);
  const targetPanRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });
  const pinchRef = useRef<{ dist: number } | null>(null);
  const followRef = useRef(false); // camera follows the expanded node
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const clockRef = useRef(0);
  const reducedMotionRef = useRef(false);

  // ---- Build nodes + pre-settle the simulation ----
  useEffect(() => {
    const rand = mulberry32(hashString(posts.map(p => p.slug).join('|')));
    const postsByTag = new Map<string, GraphPost[]>();
    for (const p of posts) {
      if (!postsByTag.has(p.tag)) postsByTag.set(p.tag, []);
      postsByTag.get(p.tag)!.push(p);
    }
    const tags = [...postsByTag.keys()];

    const clusterR = new Map<string, number>();
    for (const [tag, tagPosts] of postsByTag) {
      clusterR.set(tag, Math.max(100, Math.sqrt(tagPosts.length) * (POST_RADIUS + NODE_GAP) * 1.2));
    }

    // Hub anchors on a circle wide enough that neighboring clusters clear each other
    let hubDist = 0;
    for (let i = 0; i < tags.length; i++) {
      const a = clusterR.get(tags[i])!;
      const b = clusterR.get(tags[(i + 1) % tags.length])!;
      const needed = (a + b + 100) / (2 * Math.sin(Math.PI / Math.max(tags.length, 2)));
      hubDist = Math.max(hubDist, needed, a + 140);
    }

    const hubs = new Map<string, HubNode>();
    tags.forEach((tag, i) => {
      const angle = (i / tags.length) * Math.PI * 2 - Math.PI / 2;
      hubs.set(tag, {
        tag,
        x: Math.cos(angle) * hubDist,
        y: Math.sin(angle) * hubDist,
        vx: 0, vy: 0,
        anchorX: Math.cos(angle) * hubDist,
        anchorY: Math.sin(angle) * hubDist,
        restLen: clusterR.get(tag)! * 0.75,
      });
    });
    hubsRef.current = hubs;

    const nodes: PostNode[] = [];
    for (const [tag, tagPosts] of postsByTag) {
      const hub = hubs.get(tag)!;
      const R = clusterR.get(tag)!;
      tagPosts.forEach((p, i) => {
        const t = (i + 0.5) / tagPosts.length;
        const r = R * Math.sqrt(t) * 0.8 + POST_RADIUS + 30;
        const angle = i * GOLDEN_ANGLE + rand() * 0.2;
        nodes.push({
          x: hub.x + Math.cos(angle) * r,
          y: hub.y + Math.sin(angle) * r,
          vx: 0, vy: 0,
          slug: p.slug, title: p.title, tag: p.tag,
          featureImage: p.featureImage, images: p.images,
          img: null, imgT: 0, hoverT: 0,
          breathePhase: rand() * Math.PI * 2,
          breatheSpeed: 0.5 + rand() * 0.5,
          restScale: 0.72 + rand() * 0.66,
        });
      });
    }

    // Pre-settle so the first paint is calm (~1.5s of simulated time)
    for (let i = 0; i < 180; i++) stepGraph(nodes, hubs, SUB_STEP, 0, null, false);

    nodesRef.current = nodes;
    for (const n of nodes) if (n.featureImage) loadInto(n, n.featureImage);

    // Fit-to-view happens in the render loop once the window has real
    // dimensions (they can be 0 here in prerendered/hidden tabs).
    extentRef.current = nodes.reduce((m, n) => Math.max(m, Math.hypot(n.x, n.y)), 0) + POST_RADIUS + 70;
    fitZoomRef.current = 0;
  }, [posts]);

  /** Compute fit-to-view zoom; adopts it while the camera is untouched. Safe to call repeatedly. */
  const applyFit = useCallback(() => {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return false;
    const prevFit = fitZoomRef.current;
    const fit = Math.min(1, Math.min(w, h) / (extentRef.current * 2));
    fitZoomRef.current = fit;
    const untouched = targetZoomRef.current <= 0.011 || targetZoomRef.current === prevFit;
    if (untouched) {
      targetZoomRef.current = fit;
      if (zoomRef.current <= 0.011) zoomRef.current = fit * 0.8; // ease in from slightly wider
    }
    return true;
  }, []);

  // ---- Expand / collapse ----
  const expandPost = useCallback((node: PostNode) => {
    expandedRef.current = node;
    setExpandedUI(true);

    const count = node.images.length;
    // Children start at the parent and burst outward; physics settles them.
    const rand = mulberry32(hashString(node.slug));
    const restLen = Math.max(POST_RADIUS + CHILD_RADIUS + 40, Math.sqrt(count) * CHILD_RADIUS * 1.35);
    childRestRef.current = restLen;
    const children: ChildNode[] = node.images.map((src, i) => {
      const angle = i * GOLDEN_ANGLE + rand() * 0.3;
      const speed = 260 + rand() * 160;
      return {
        src,
        img: null, imgT: 0,
        x: node.x + Math.cos(angle) * 4,
        y: node.y + Math.sin(angle) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        bornT: 0, hoverT: 0,
      };
    });
    childrenRef.current = children;
    for (const c of children) loadInto(c, c.src);

    // Zoom just enough to frame the settled cloud of images
    const blobR = restLen + Math.sqrt(count) * CHILD_RADIUS * 0.9 + 70;
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    const zoom = Math.max(1.1, Math.min(2.6, (minDim / 2) / blobR));
    targetZoomRef.current = zoom;
    targetPanRef.current = { x: -node.x * zoom, y: -node.y * zoom };
    followRef.current = true;
  }, []);

  const collapsePost = useCallback(() => {
    expandedRef.current = null;
    childrenRef.current = [];
    setExpandedUI(false);
    targetZoomRef.current = fitZoomRef.current;
    targetPanRef.current = { x: 0, y: 0 };
  }, []);

  // ---- Render + simulation loop (persistent) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const makeStars = (w: number, h: number) => {
      const rand = mulberry32(97);
      const count = Math.floor((w * h) / 9000);
      const stars: Star[] = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: rand() * w, y: rand() * h,
          size: 0.4 + rand() * 1.1,
          alpha: 0.08 + rand() * 0.3,
          parallax: 0.06 + rand() * 0.18,
          phase: rand() * Math.PI * 2,
        });
      }
      starsRef.current = stars;
    };

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      makeStars(w, h);
      applyFit();
    };
    resize();
    window.addEventListener('resize', resize);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedRef.current) collapsePost();
    };
    window.addEventListener('keydown', onKey);

    let simAccum = 0;

    const tick = (now: number) => {
      const nodes = nodesRef.current;
      const hubs = hubsRef.current;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const reduced = reducedMotionRef.current;

      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, MAX_FRAME_DT);
      lastTimeRef.current = now;
      clockRef.current += dt;
      const t = clockRef.current;
      const ease = (k: number) => 1 - Math.exp(-k * dt);

      // Recover from mounting in a zero-sized/hidden window
      if (fitZoomRef.current <= 0.011 && !applyFit()) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (canvas.width < 2 || Math.abs(canvas.width - Math.max(1, window.innerWidth) * dpr) > 1) resize();

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Camera easing
      const camEase = ease(6);
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * camEase;
      panRef.current.x += (targetPanRef.current.x - panRef.current.x) * camEase;
      panRef.current.y += (targetPanRef.current.y - panRef.current.y) * camEase;
      const zoom = zoomRef.current;
      const pan = panRef.current;

      const dimTarget = expandedRef.current ? 1 : 0;
      dimTRef.current += (dimTarget - dimTRef.current) * ease(7);
      const dimT = dimTRef.current;

      // Keep the expanded post centered as the simulation drifts,
      // until the user takes the camera (pan/zoom) themselves.
      if (expandedRef.current && followRef.current) {
        targetPanRef.current = {
          x: -expandedRef.current.x * targetZoomRef.current,
          y: -expandedRef.current.y * targetZoomRef.current,
        };
      }

      // Mouse in world coordinates
      const mx = (mouseRef.current.sx - w / 2 - pan.x) / zoom;
      const my = (mouseRef.current.sy - h / 2 - pan.y) / zoom;

      // ---- Physics (fixed timestep) ----
      const grabbed = grabbedRef.current;
      if (grabbed) {
        // Drive the grabbed node toward the cursor; velocity comes along so
        // releasing mid-motion throws it into the web.
        const k = 1 - Math.exp(-20 * dt);
        const prevX = grabbed.x, prevY = grabbed.y;
        grabbed.x += (mx - grabbed.x) * k;
        grabbed.y += (my - grabbed.y) * k;
        if (dt > 0) {
          grabbed.vx = Math.max(-MAX_VEL, Math.min(MAX_VEL, (grabbed.x - prevX) / dt));
          grabbed.vy = Math.max(-MAX_VEL, Math.min(MAX_VEL, (grabbed.y - prevY) / dt));
        }
      }
      simAccum = Math.min(simAccum + dt, MAX_FRAME_DT);
      while (simAccum >= SUB_STEP) {
        stepGraph(nodes, hubs, SUB_STEP, t, grabbed, !reduced);
        const parentSim = expandedRef.current;
        if (parentSim && childrenRef.current.length) {
          stepChildren(childrenRef.current, parentSim, childRestRef.current, SUB_STEP);
        }
        simAccum -= SUB_STEP;
      }

      // ---- Render ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#08080c';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';

      // Starfield (screen space, parallax against pan)
      const stars = starsRef.current;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const px = (((s.x + pan.x * s.parallax) % w) + w) % w;
        const py = (((s.y + pan.y * s.parallax) % h) + h) % h;
        const tw = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 0.9 + s.phase);
        ctx.globalAlpha = s.alpha * tw;
        ctx.fillRect(px, py, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
      ctx.scale(zoom, zoom);

      // Hover hit-testing
      let newHovered: PostNode | null = grabbed;
      if (!newHovered) {
        let bestDist = Infinity;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const dx = n.x - mx, dy = n.y - my;
          const d2 = dx * dx + dy * dy;
          const hitR = POST_RADIUS * (1 + 0.3 * n.hoverT) + 6;
          if (d2 < hitR * hitR && d2 < bestDist) { bestDist = d2; newHovered = n; }
        }
      }

      const children = childrenRef.current;
      const parent = expandedRef.current;
      let newHoveredChild = -1;
      if (parent && !grabbed) {
        let bestChild = Infinity;
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          const dx = c.x - mx, dy = c.y - my;
          const d2 = dx * dx + dy * dy;
          const hitR = CHILD_RADIUS * (1 + 0.25 * c.hoverT) + 5;
          if (c.bornT > 0.4 && d2 < hitR * hitR && d2 < bestChild) { bestChild = d2; newHoveredChild = i; }
        }
        if (newHoveredChild >= 0) newHovered = null;
      }

      // Edges: root → hubs
      ctx.lineWidth = 1.25 / zoom;
      for (const [tag, hub] of hubs) {
        ctx.strokeStyle = (TAG_COLORS[tag] || '#888') + '2e';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(hub.x, hub.y);
        ctx.stroke();
      }

      // Edges: hub → posts (hovered node's link glows)
      const edgeDim = 1 - dimT * 0.75;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const hub = hubs.get(n.tag);
        if (!hub) continue;
        const glow = n.hoverT;
        ctx.globalAlpha = edgeDim * (0.5 + 0.5 * glow);
        ctx.strokeStyle = (TAG_COLORS[n.tag] || '#888') + (glow > 0.3 ? '66' : '22');
        ctx.lineWidth = (0.6 + glow * 0.8) / zoom;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Root node — soft pulsing core
      const pulse = reduced ? 1 : 1 + Math.sin(t * 1.2) * 0.12;
      const rootGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * pulse);
      rootGlow.addColorStop(0, 'rgba(255,255,255,0.28)');
      rootGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rootGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();

      // Post nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const isHov = n === newHovered;
        n.hoverT += ((isHov ? 1 : 0) - n.hoverT) * ease(11);
        if (n.img && n.imgT < 1) n.imgT = Math.min(1, n.imgT + dt * 3);
        const isFocus = parent && n.slug === parent.slug;
        const r = POST_RADIUS * (1 + 0.3 * n.hoverT);
        const alpha = parent
          ? (isFocus ? 1 : 1 - dimT * 0.85)
          : 0.88 + 0.12 * n.hoverT;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = (TAG_COLORS[n.tag] || '#444') + '33';
        ctx.fill();
        if (n.img && n.imgT > 0) {
          ctx.globalAlpha = alpha * n.imgT;
          drawCircleImage(ctx, n.img, n.x, n.y, r);
        }
        ctx.restore();

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = n.hoverT > 0.02
          ? `rgba(255,255,255,${0.15 + 0.45 * n.hoverT})`
          : (TAG_COLORS[n.tag] || '#888') + '4d';
        ctx.lineWidth = (1 + n.hoverT) / zoom;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 1.5 / zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Expanded children
      if (parent) {
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          c.bornT = Math.min(1, c.bornT + dt * 2.7);
          if (c.img && c.imgT < 1) c.imgT = Math.min(1, c.imgT + dt * 3.6);
          const bt = 1 - Math.pow(1 - c.bornT, 3);
          const isHov = i === newHoveredChild;
          c.hoverT += ((isHov ? 1 : 0) - c.hoverT) * ease(12);
          const r = CHILD_RADIUS * (1 + 0.25 * c.hoverT) * (0.4 + 0.6 * bt);

          ctx.globalAlpha = 0.35 * bt * dimT;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 0.6 / zoom;
          ctx.beginPath();
          ctx.moveTo(parent.x, parent.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();

          ctx.save();
          ctx.globalAlpha = bt * (0.8 + 0.2 * c.hoverT);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fill();
          if (c.img && c.imgT > 0) {
            ctx.globalAlpha = bt * c.imgT * (0.85 + 0.15 * c.hoverT);
            drawCircleImage(ctx, c.img, c.x, c.y, r);
          }
          ctx.restore();

          if (c.hoverT > 0.02) {
            ctx.globalAlpha = c.hoverT * bt;
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.25 / zoom;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r + 2 / zoom, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // Tag labels
      ctx.font = `${11 / zoom}px 'Geist Mono', ui-monospace, monospace`;
      ctx.textAlign = 'center';
      for (const [tag, hub] of hubs) {
        ctx.globalAlpha = 1 - dimT * 0.8;
        ctx.fillStyle = (TAG_COLORS[tag] || '#888') + 'b3';
        const away = Math.hypot(hub.x, hub.y) || 1;
        const lx = hub.x + (hub.x / away) * (16 / zoom);
        const ly = hub.y + (hub.y / away) * (16 / zoom);
        ctx.fillText(tag, lx, ly + 4 / zoom);
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      // Hover label (DOM overlay)
      hoveredRef.current = newHovered;
      hoveredChildRef.current = newHoveredChild;
      const label = labelRef.current;
      if (label) {
        const target = newHovered && newHovered !== parent && !grabbed ? newHovered : null;
        if (target) {
          const sx = w / 2 + pan.x + target.x * zoom;
          const sy = h / 2 + pan.y + (target.y - POST_RADIUS * (1 + 0.3 * target.hoverT)) * zoom - 12;
          label.style.opacity = '1';
          label.style.transform = `translate(-50%, -100%) translate(${sx}px, ${Math.max(44, sy)}px)`;
          const count = target.images.length;
          label.innerHTML = `<strong>${escapeHtml(target.title)}</strong><span>${target.tag}${count ? ` · ${count} image${count === 1 ? '' : 's'}` : ''}</span>`;
        } else {
          label.style.opacity = '0';
        }
      }

      canvas.style.cursor = grabbed
        ? 'grabbing'
        : dragRef.current.active
          ? 'grabbing'
          : (newHovered || newHoveredChild >= 0) ? 'pointer' : 'grab';

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
    };
  }, [collapsePost, applyFit]);

  // ---- Pointer input ----
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { sx: e.clientX - rect.left, sy: e.clientY - rect.top };

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) dragRef.current.moved = true;
      if (!grabbedRef.current) {
        if (dragRef.current.moved) followRef.current = false;
        panRef.current.x = dragRef.current.panStartX + dx;
        panRef.current.y = dragRef.current.panStartY + dy;
        targetPanRef.current = { ...panRef.current };
      }
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true, moved: false,
      startX: e.clientX, startY: e.clientY,
      panStartX: panRef.current.x, panStartY: panRef.current.y,
    };
    // Grab the hovered node instead of panning — this is the Obsidian feel
    if (hoveredRef.current) grabbedRef.current = hoveredRef.current;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
    grabbedRef.current = null;
  }, []);

  const openPost = useCallback((node: PostNode) => {
    window.location.href = `/portfolio?post=${node.slug}&tab=${node.tag}`;
  }, []);

  const handleClick = useCallback(() => {
    if (dragRef.current.moved) return; // drag or node-throw, not a click
    const hovered = hoveredRef.current;
    const parent = expandedRef.current;
    if (hoveredChildRef.current >= 0 && parent) {
      openPost(parent);
      return;
    }
    if (hovered) {
      if (parent && parent.slug === hovered.slug) openPost(hovered);
      else if (hovered.images.length === 0) openPost(hovered);
      else expandPost(hovered);
    } else if (parent) {
      collapsePost();
    }
  }, [expandPost, collapsePost, openPost]);

  const handleDoubleClick = useCallback(() => {
    if (!hoveredRef.current && !expandedRef.current) {
      targetZoomRef.current = fitZoomRef.current;
      targetPanRef.current = { x: 0, y: 0 };
    }
  }, []);

  // Wheel zoom anchored to the cursor + touch pan/pinch (non-passive listeners)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomAt = (sx: number, sy: number, factor: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = sx - rect.left - rect.width / 2;
      const cy = sy - rect.top - rect.height / 2;
      const prev = targetZoomRef.current;
      const next = Math.max(fitZoomRef.current * 0.4, Math.min(8, prev * factor));
      const wx = (cx - targetPanRef.current.x) / prev;
      const wy = (cy - targetPanRef.current.y) / prev;
      targetZoomRef.current = next;
      targetPanRef.current = { x: cx - wx * next, y: cy - wy * next };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      followRef.current = false;
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomAt(e.clientX, e.clientY, factor);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = { sx: t.clientX - rect.left, sy: t.clientY - rect.top };
        dragRef.current = {
          active: true, moved: false,
          startX: t.clientX, startY: t.clientY,
          panStartX: panRef.current.x, panStartY: panRef.current.y,
        };
      } else if (e.touches.length === 2) {
        dragRef.current.active = false;
        grabbedRef.current = null;
        pinchRef.current = { dist: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragRef.current.active) {
        const t = e.touches[0];
        const dx = t.clientX - dragRef.current.startX;
        const dy = t.clientY - dragRef.current.startY;
        if (Math.abs(dx) + Math.abs(dy) > 8) dragRef.current.moved = true;
        if (!grabbedRef.current) {
          if (dragRef.current.moved) followRef.current = false;
          panRef.current.x = dragRef.current.panStartX + dx;
          panRef.current.y = dragRef.current.panStartY + dy;
          targetPanRef.current = { ...panRef.current };
        }
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = { sx: t.clientX - rect.left, sy: t.clientY - rect.top };
      } else if (e.touches.length === 2 && pinchRef.current) {
        followRef.current = false;
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAt(midX, midY, dist / pinchRef.current.dist);
        pinchRef.current.dist = dist;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        pinchRef.current = null;
        const wasDrag = dragRef.current.moved;
        dragRef.current.active = false;
        grabbedRef.current = null;
        if (!wasDrag) {
          handleClickRef.current();
          mouseRef.current = { sx: -9999, sy: -9999 };
        }
      } else if (e.touches.length === 1) {
        pinchRef.current = null;
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Stable ref to the click handler for the touch listeners above
  const handleClickRef = useRef(handleClick);
  useEffect(() => { handleClickRef.current = handleClick; }, [handleClick]);

  const hudStyle: React.CSSProperties = {
    position: 'absolute', color: 'rgba(255,255,255,0.4)', fontSize: 11,
    fontFamily: "'Geist Mono', ui-monospace, monospace", letterSpacing: '0.02em',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'radial-gradient(ellipse 120% 90% at 50% 35%, #0d0d13 0%, #07070a 70%)', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); mouseRef.current = { sx: -9999, sy: -9999 }; }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ display: 'block' }}
      />
      <div
        ref={labelRef}
        style={{
          position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: 0,
          transition: 'opacity 0.18s ease', textAlign: 'center', whiteSpace: 'nowrap',
          color: 'rgba(255,255,255,0.9)', fontSize: 12.5,
          fontFamily: "'Geist Mono', ui-monospace, monospace",
          textShadow: '0 1px 8px rgba(0,0,0,0.9)',
          display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center',
        }}
      />
      <div style={{ ...hudStyle, top: 16, left: 20, pointerEvents: 'none' }}>
        {posts.length} posts · click to expand · drag nodes · scroll to zoom
      </div>
      {expandedUI && (
        <button
          onClick={collapsePost}
          style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)', fontSize: 11,
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, padding: '5px 14px', cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}
        >
          ← collapse <span style={{ opacity: 0.5 }}>(esc)</span>
        </button>
      )}
      <a href="/" style={{ ...hudStyle, top: 16, right: 20, textDecoration: 'none' }}>
        ← back
      </a>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
