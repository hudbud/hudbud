import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type Facing = 'all' | 'work' | 'life';

interface HeadSceneProps {
  facing: Facing;
  ghost?: Facing | null;
  playIntroSweep?: boolean;
  onSweepStage?: (stage: Facing | null) => void;
  theme: string;
  height?: number;
}

// Yaw targets: negative turns the head toward screen-left (Work), positive
// toward screen-right (Life) — derived from three.js's right-handed Y-axis
// rotation with the camera looking down -Z.
const YAW: Record<Facing, number> = { all: 0, work: -0.55, life: 0.55 };

// A lightweight critically-damped-ish spring integrator, tuned by feel to
// land near the site's shared framer-motion SPRING (visualDuration 0.3, bounce 0.15).
const SPRING_K = 170;
const SPRING_C = 20;
const SETTLE_POS_EPSILON = 0.01;
const SETTLE_VEL_EPSILON = 0.05;

// The load-time sweep: turn to Work, hold, turn to Life, hold, settle on All.
const SWEEP_WAYPOINTS: { facing: Facing; hold: number }[] = [
  { facing: 'work', hold: 550 },
  { facing: 'life', hold: 550 },
  { facing: 'all', hold: 0 },
];
const SWEEP_START_DELAY = 400;

/**
 * Builds the head mesh. v1 is a low-poly primitive stand-in; a future .glb
 * swap only needs to replace this function's body — callers never change.
 * Mesh names ('skin' / 'accent') are the contract `applyThemeColors` recolors by.
 */
async function buildHead(): Promise<THREE.Object3D> {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7, metalness: 0.05 });
  const accentMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.4, metalness: 0.1 });

  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), skinMat);
  skull.name = 'skin';
  group.add(skull);

  // Low-poly nose (tetrahedron-like cone) — makes yaw legible on an otherwise symmetric skull.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 4), skinMat);
  nose.name = 'skin';
  nose.rotation.x = Math.PI / 2;
  nose.rotation.z = Math.PI / 4;
  nose.position.set(0, -0.02, 0.56);
  group.add(nose);

  const eyeGeo = new THREE.CircleGeometry(0.07, 12);
  const eyeL = new THREE.Mesh(eyeGeo, accentMat);
  eyeL.name = 'accent';
  eyeL.position.set(-0.22, 0.1, 0.53);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, accentMat);
  eyeR.name = 'accent';
  eyeR.position.set(0.22, 0.1, 0.53);
  group.add(eyeR);

  return group;
}

function forEachMesh(obj: THREE.Object3D, fn: (mesh: THREE.Mesh, mat: THREE.MeshStandardMaterial) => void) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) fn(child, child.material as THREE.MeshStandardMaterial);
  });
}

function applyThemeColors(head: THREE.Object3D, colors: { skin: string; accent: string }) {
  forEachMesh(head, (mesh, mat) => {
    if (mesh.name === 'skin') mat.color.set(colors.skin);
    else if (mesh.name === 'accent') mat.color.set(colors.accent);
  });
}

// CSS custom properties can be color-mix()/animated (see themes.ts), so the
// only reliable read is the browser's own resolved value via a probe element
// rather than parsing the variable text ourselves.
function readThemeColors(container: HTMLElement): { skin: string; accent: string } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--fg);background-color:var(--accent);';
  container.appendChild(probe);
  const cs = getComputedStyle(probe);
  const colors = { skin: cs.color, accent: cs.backgroundColor };
  container.removeChild(probe);
  return colors;
}

/** Deep-clones a head with independent, transparent materials — used for the hover ghost. */
function cloneAsGhost(head: THREE.Object3D): THREE.Object3D {
  const ghost = head.clone(true);
  forEachMesh(ghost, (mesh, mat) => {
    const cloned = mat.clone();
    cloned.transparent = true;
    cloned.opacity = 0;
    cloned.depthWrite = false;
    mesh.material = cloned;
    mesh.renderOrder = 1;
  });
  return ghost;
}

export default function HeadScene({ facing, ghost = null, playIntroSweep = true, onSweepStage, theme, height = 180 }: HeadSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const facingRef = useRef(facing);
  const ghostRef = useRef(ghost);
  const onSweepStageRef = useRef(onSweepStage);
  const headRef = useRef<THREE.Object3D | null>(null);
  const ghostHeadRef = useRef<THREE.Object3D | null>(null);
  const cancelSweepRef = useRef<(() => void) | null>(null);
  const facingMounted = useRef(false);

  useEffect(() => {
    facingRef.current = facing;
    // Any real facing change (a pill click) interrupts the intro sweep — but
    // not the very first render, which is just the initial value settling in.
    if (facingMounted.current) cancelSweepRef.current?.();
    facingMounted.current = true;
  }, [facing]);

  useEffect(() => {
    ghostRef.current = ghost;
  }, [ghost]);

  useEffect(() => {
    onSweepStageRef.current = onSweepStage;
  }, [onSweepStage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(2, 3, 4);
    scene.add(key);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let yaw = YAW[facingRef.current];
    let yawVel = 0;
    let ghostOpacity = 0;

    // Sweep queue: null when idle/finished. Consumed one waypoint at a time,
    // only advancing once the spring has actually settled near it.
    let sweepQueue: { facing: Facing; hold: number }[] | null = null;
    let sweepHoldUntil = 0;
    let sweepStarted = false;
    const sweepStartAt = performance.now() + SWEEP_START_DELAY;

    cancelSweepRef.current = () => {
      if (!sweepQueue) return;
      sweepQueue = null;
      onSweepStageRef.current?.(null);
    };

    buildHead().then((head) => {
      if (disposed) return;
      headRef.current = head;
      head.rotation.y = yaw;
      scene.add(head);
      applyThemeColors(head, readThemeColors(container));

      const ghostHead = cloneAsGhost(head);
      ghostHeadRef.current = ghostHead;
      scene.add(ghostHead);

      if (playIntroSweep && !prefersReducedMotion) {
        sweepQueue = [...SWEEP_WAYPOINTS];
      }

      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(32, now - last) / 1000;
        last = now;

        if (sweepQueue && sweepQueue.length > 0) {
          if (!sweepStarted && now >= sweepStartAt) sweepStarted = true;
          if (sweepStarted) {
            const wp = sweepQueue[0];
            const wpTarget = YAW[wp.facing];
            const settled = Math.abs(wpTarget - yaw) < SETTLE_POS_EPSILON && Math.abs(yawVel) < SETTLE_VEL_EPSILON;
            if (settled) {
              if (sweepHoldUntil === 0) {
                sweepHoldUntil = now + wp.hold;
                onSweepStageRef.current?.(wp.facing === 'all' ? null : wp.facing);
              }
              if (now >= sweepHoldUntil) {
                sweepQueue.shift();
                sweepHoldUntil = 0;
                if (sweepQueue.length === 0) {
                  sweepQueue = null;
                  onSweepStageRef.current?.(null);
                }
              }
            }
          }
        }

        const activeFacing = sweepQueue && sweepQueue.length > 0 && sweepStarted ? sweepQueue[0].facing : facingRef.current;
        const target = YAW[activeFacing];
        if (prefersReducedMotion) {
          yaw = target;
          yawVel = 0;
        } else {
          const accel = SPRING_K * (target - yaw) - SPRING_C * yawVel;
          yawVel += accel * dt;
          yaw += yawVel * dt;
        }
        head.rotation.y = yaw;
        head.position.y = prefersReducedMotion ? 0 : Math.sin(now * 0.0012) * 0.015;

        const ghostTarget = ghostRef.current ? 0.5 : 0;
        ghostOpacity += (ghostTarget - ghostOpacity) * Math.min(1, dt * 10);
        if (ghostRef.current) ghostHead.rotation.y = YAW[ghostRef.current];
        ghostHead.position.y = head.position.y;
        forEachMesh(ghostHead, (_mesh, mat) => { mat.opacity = ghostOpacity; });

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelSweepRef.current = null;
      resizeObserver.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme changes (including runtime shuffles from the chrome menu) recolor
  // the existing head + ghost in place — colors are read straight from
  // resolved CSS, so this effect only needs `theme` as a signal something changed.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !headRef.current) return;
    const colors = readThemeColors(container);
    applyThemeColors(headRef.current, colors);
    if (ghostHeadRef.current) applyThemeColors(ghostHeadRef.current, colors);
  }, [theme]);

  return <div ref={containerRef} style={{ width: '100%', height, pointerEvents: 'none' }} />;
}
