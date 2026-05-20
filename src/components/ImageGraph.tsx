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
  slug: string;
  title: string;
  tag: string;
  featureImage?: string;
  images: string[];
  img: HTMLImageElement | null;
  loaded: boolean;
}

const TAG_COLORS: Record<string, string> = {
  work: '#e8a838',
  thoughts: '#7ec8e3',
  life: '#82c97a',
  archive: '#b8b8b8',
  resources: '#d4a5d4',
};

const POST_RADIUS = 30;
const TAG_RADIUS = 14;
const EXPANDED_CHILD_RADIUS = 20;

export default function ImageGraph({ posts }: { posts: GraphPost[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const postsRef = useRef<PostNode[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [childImages, setChildImages] = useState<{ src: string; img: HTMLImageElement | null; x: number; y: number }[]>([]);
  const hoveredRef = useRef<PostNode | null>(null);
  const hoveredChildRef = useRef<number>(-1);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const targetZoomRef = useRef(1);
  const targetPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panStartX: number; panStartY: number }>({ active: false, startX: 0, startY: 0, panStartX: 0, panStartY: 0 });
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    const tags = [...new Set(posts.map(p => p.tag))];
    const tagPositions = new Map<string, { x: number; y: number }>();

    // Place tag hubs in a circle around center
    const tagRadius = 300;
    tags.forEach((tag, i) => {
      const angle = (i / tags.length) * Math.PI * 2 - Math.PI / 2;
      tagPositions.set(tag, { x: Math.cos(angle) * tagRadius, y: Math.sin(angle) * tagRadius });
    });

    // Place posts around their tag hub
    const nodes: PostNode[] = [];

    // Central root node
    nodes.push({
      x: 0, y: 0,
      slug: '__root__', title: 'paine.design', tag: 'root',
      featureImage: undefined, images: [],
      img: null, loaded: true,
    });

    const postsByTag = new Map<string, GraphPost[]>();
    for (const p of posts) {
      if (!postsByTag.has(p.tag)) postsByTag.set(p.tag, []);
      postsByTag.get(p.tag)!.push(p);
    }

    for (const [tag, tagPosts] of postsByTag) {
      const hub = tagPositions.get(tag)!;
      const count = tagPosts.length;
      const ringRadius = 60 + count * 8;
      tagPosts.forEach((p, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        nodes.push({
          x: hub.x + Math.cos(angle) * ringRadius,
          y: hub.y + Math.sin(angle) * ringRadius,
          slug: p.slug,
          title: p.title,
          tag: p.tag,
          featureImage: p.featureImage,
          images: p.images,
          img: null,
          loaded: false,
        });
      });
    }

    postsRef.current = nodes;

    // Load feature images
    for (const n of nodes) {
      if (n.featureImage) {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => { n.img = el; n.loaded = true; };
        el.src = n.featureImage;
      }
    }
  }, [posts]);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const dpr = devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    return {
      x: (sx - w / 2 - panRef.current.x) / zoomRef.current,
      y: (sy - h / 2 - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // Expand post: zoom in and show child images
  const expandPost = useCallback((node: PostNode) => {
    setExpanded(node.slug);
    targetZoomRef.current = 3;
    targetPanRef.current = { x: -node.x * 3, y: -node.y * 3 };

    const children = node.images.map((src, i) => {
      const count = node.images.length;
      const angle = (i / count) * Math.PI * 2;
      const r = 60 + (count > 12 ? 20 : 0);
      return {
        src,
        img: null as HTMLImageElement | null,
        x: node.x + Math.cos(angle) * r,
        y: node.y + Math.sin(angle) * r,
      };
    });
    setChildImages(children);

    // Load child images
    for (const child of children) {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => { child.img = el; };
      el.src = child.src;
    }
  }, []);

  const collapsePost = useCallback(() => {
    setExpanded(null);
    setChildImages([]);
    targetZoomRef.current = 1;
    targetPanRef.current = { x: 0, y: 0 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = () => {
      const nodes = postsRef.current;
      const dpr = devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      if (!isHoveringRef.current) frameRef.current++;

      // Animate zoom/pan
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * 0.08;
      panRef.current.x += (targetPanRef.current.x - panRef.current.x) * 0.08;
      panRef.current.y += (targetPanRef.current.y - panRef.current.y) * 0.08;

      // Render
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + panRef.current.x, h / 2 + panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      let newHovered: PostNode | null = null;
      let newHoveredChild = -1;

      // Draw tag labels and connections
      const tags = [...new Set(nodes.filter(n => n.slug !== '__root__').map(n => n.tag))];
      const tagCenters = new Map<string, { x: number; y: number }>();
      for (const tag of tags) {
        const tagNodes = nodes.filter(n => n.tag === tag && n.slug !== '__root__');
        const cx = tagNodes.reduce((s, n) => s + n.x, 0) / tagNodes.length;
        const cy = tagNodes.reduce((s, n) => s + n.y, 0) / tagNodes.length;
        tagCenters.set(tag, { x: cx, y: cy });
      }

      // Lines from root to tag centers
      ctx.lineWidth = 1.5 / zoomRef.current;
      for (const [tag, pos] of tagCenters) {
        ctx.strokeStyle = (TAG_COLORS[tag] || '#888') + '30';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      // Lines from tag center to posts
      const f0 = frameRef.current;
      ctx.lineWidth = 0.5 / zoomRef.current;
      for (let ni = 0; ni < nodes.length; ni++) {
        const n = nodes[ni];
        if (n.slug === '__root__') continue;
        const center = tagCenters.get(n.tag)!;
        const fx = Math.sin(f0 * 0.003 + ni * 1.7) * 3;
        const fy = Math.cos(f0 * 0.004 + ni * 2.3) * 2.5;
        ctx.strokeStyle = (TAG_COLORS[n.tag] || '#888') + '15';
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(n.x + fx, n.y + fy);
        ctx.stroke();
      }

      // Draw expanded child images
      if (expanded) {
        const parentNode = nodes.find(n => n.slug === expanded);
        if (parentNode) {
          for (let i = 0; i < childImages.length; i++) {
            const child = childImages[i];
            // Line from parent to child
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5 / zoomRef.current;
            ctx.beginPath();
            ctx.moveTo(parentNode.x, parentNode.y);
            ctx.lineTo(child.x, child.y);
            ctx.stroke();

            const dx = child.x - mx;
            const dy = child.y - my;
            const isHov = dx * dx + dy * dy < EXPANDED_CHILD_RADIUS * EXPANDED_CHILD_RADIUS * 2;
            if (isHov) newHoveredChild = i;
            const r = isHov ? EXPANDED_CHILD_RADIUS * 1.4 : EXPANDED_CHILD_RADIUS;

            ctx.save();
            ctx.globalAlpha = child.img ? (isHov ? 1 : 0.85) : 0.2;
            ctx.beginPath();
            ctx.arc(child.x, child.y, r, 0, Math.PI * 2);
            ctx.clip();
            if (child.img) {
              ctx.drawImage(child.img, child.x - r, child.y - r, r * 2, r * 2);
            } else {
              ctx.fillStyle = 'rgba(255,255,255,0.1)';
              ctx.fill();
            }
            ctx.restore();

            if (isHov) {
              ctx.strokeStyle = 'rgba(255,255,255,0.5)';
              ctx.lineWidth = 1.5 / zoomRef.current;
              ctx.beginPath();
              ctx.arc(child.x, child.y, r + 2, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }

      // Draw central root node
      const rootR = 10;
      ctx.beginPath();
      ctx.arc(0, 0, rootR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1 / zoomRef.current;
      ctx.stroke();

      // Draw post nodes
      const f = frameRef.current;
      for (let ni = 0; ni < nodes.length; ni++) {
        const n = nodes[ni];
        if (n.slug === '__root__') continue;
        const floatX = Math.sin(f * 0.003 + ni * 1.7) * 3;
        const floatY = Math.cos(f * 0.004 + ni * 2.3) * 2.5;
        const nx = n.x + floatX;
        const ny = n.y + floatY;
        const dx = nx - mx;
        const dy = ny - my;
        const isHov = dx * dx + dy * dy < POST_RADIUS * POST_RADIUS * 1.5;
        if (isHov) newHovered = n;

        const isExpanded = n.slug === expanded;
        const r = isHov ? POST_RADIUS * 1.3 : POST_RADIUS;
        const alpha = expanded ? (isExpanded ? 1 : 0.2) : (isHov ? 1 : 0.8);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.clip();
        if (n.loaded && n.img) {
          ctx.drawImage(n.img, nx - r, ny - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = (TAG_COLORS[n.tag] || '#444') + '40';
          ctx.fill();
        }
        ctx.restore();

        // Border
        ctx.strokeStyle = isHov ? 'rgba(255,255,255,0.6)' : (TAG_COLORS[n.tag] || '#888') + '40';
        ctx.lineWidth = (isHov ? 2 : 1) / zoomRef.current;
        ctx.beginPath();
        ctx.arc(nx, ny, r + 1, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tag labels
      ctx.font = `${11 / zoomRef.current}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      for (const [tag, pos] of tagCenters) {
        ctx.fillStyle = (TAG_COLORS[tag] || '#888') + '80';
        ctx.fillText(tag, pos.x, pos.y - 10 / zoomRef.current);
      }

      ctx.restore();

      // Hover label
      if (newHovered && !expanded) {
        const screenX = w / 2 + panRef.current.x + newHovered.x * zoomRef.current;
        const screenY = h / 2 + panRef.current.y + newHovered.y * zoomRef.current - POST_RADIUS * 1.3 * zoomRef.current - 10;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(newHovered.title, screenX, Math.max(20, screenY));
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${newHovered.images.length} images`, screenX, Math.max(20, screenY) + 14);
      }

      hoveredRef.current = newHovered;
      hoveredChildRef.current = newHoveredChild;
      isHoveringRef.current = !!(newHovered || newHoveredChild >= 0);
      const label = newHovered?.title ?? null;
      if (label !== hoveredLabel) setHoveredLabel(label);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [expanded, childImages]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      panRef.current.x = dragRef.current.panStartX + dx;
      panRef.current.y = dragRef.current.panStartY + dy;
      targetPanRef.current = { ...panRef.current };
    }

    mouseRef.current = screenToWorld(sx, sy);
  }, [screenToWorld]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const next = Math.max(0.2, Math.min(10, targetZoomRef.current * factor));
    targetZoomRef.current = next;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener('wheel', prevent, { passive: false });
    return () => canvas.removeEventListener('wheel', prevent);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !hoveredRef.current) {
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panStartX: panRef.current.x, panStartY: panRef.current.y };
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredChildRef.current >= 0 && expanded) {
      const node = postsRef.current.find(n => n.slug === expanded);
      if (node) window.location.href = `/portfolio?post=${node.slug}&tab=${node.tag}`;
      return;
    }
    if (hoveredRef.current) {
      if (hoveredRef.current.slug === '__root__') return;
      if (expanded === hoveredRef.current.slug) {
        window.location.href = `/portfolio?post=${hoveredRef.current.slug}&tab=${hoveredRef.current.tag}`;
      } else {
        expandPost(hoveredRef.current);
      }
    } else if (expanded) {
      collapsePost();
    }
  }, [expanded, expandPost, collapsePost]);

  const hasCursor = hoveredLabel || hoveredChildRef.current >= 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{ display: 'block', cursor: hasCursor ? 'pointer' : 'grab' }}
      />
      <div style={{ position: 'absolute', top: 16, left: 20, color: 'rgba(255,255,255,0.35)', fontSize: 11, pointerEvents: 'none' }}>
        {posts.length} posts · click to expand · click again to open · scroll to zoom
      </div>
      {expanded && (
        <button
          onClick={collapsePost}
          style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
        >
          ← collapse
        </button>
      )}
      <a href="/" style={{ position: 'absolute', top: 16, right: 20, color: 'rgba(255,255,255,0.35)', fontSize: 11, textDecoration: 'none' }}>
        ← back
      </a>
    </div>
  );
}
