// Voxel set dressing for /fish: a mountain trout stream, its banks, the
// fish, a dirt singletrack, and a blocky Hudson in fly fishing kit. Boxes with
// flat Lambert shading and hard shadows, but small enough to carry some
// detail. Game logic lives in FlyFishing.tsx; this file only builds meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const BANK_Y = 0.35;
export const BED_Y = -0.75;
/** The trail runs along the near bank, one row back from the water. */
export const PATH_ROW = 1;

// The stream flows toward +x, meandering about a centerline. It swings
// toward the trail through a bend below the angler, where it pools deep
// against the outside bank.
const MA = 1.7;
const MK = 0.21;
const MP = 0.21;
/** Centerline of the stream. */
export const riverZ = (x: number) => MA * Math.sin(MK * x + MP) + 0.25 * Math.sin(0.53 * x + 1.1);
/** dz/dx of the centerline, so the current can follow the bends. */
export const riverSlope = (x: number) => MA * MK * Math.cos(MK * x + MP) + 0.25 * 0.53 * Math.cos(0.53 * x + 1.1);
const riverCurve = (x: number) => -MA * MK * MK * Math.sin(MK * x + MP) - 0.25 * 0.53 * 0.53 * Math.sin(0.53 * x + 1.1);
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The upstream walk limit is a granite wall; the downstream one a fallen spruce. */
export const WALL_X = -13.8;
export const LOGFALL_X = 13.8;

/** Half the water's width: wide in the pool, pinched through the rapids. */
export const riverHalf = (x: number) => 3.1 + 0.4 * Math.sin(MK * x + MP) - 0.55 * smooth(-11, -13.5, x);

/** Which bank: -1 is his, +1 the trail's. */
export const edgeZ = (side: number, x: number) => riverZ(x) + side * riverHalf(x);
/** Where he stands on his bank. */
export const bankZ = (x: number) => edgeZ(-1, x) - 0.85;
/** Singletrack wanders a little. */
export const trailZ = (x: number) => edgeZ(1, x) + 0.5 + PATH_ROW + Math.sin(x * 0.31) * 0.14 + Math.sin(x * 0.83 + 1) * 0.05;

// The reach, top to bottom: rapids under the wall, a riffle, the run he
// starts on, the pool on the bend, then a tailout riffling into the log fall.
// [x, current, bed depth, chop]
const REACH: [number, number, number, number][] = [
  [-40, 1.9, -0.55, 1],
  [-12.5, 1.9, -0.55, 1],
  [-10, 1.3, -0.42, 0.55],
  [-6, 1.25, -0.45, 0.5],
  [-3.5, 1, -0.8, 0.12],
  [2.5, 1, -0.85, 0.1],
  [4.8, 0.55, -1.2, 0],
  [8.6, 0.5, -1.2, 0],
  [11, 1.05, -0.55, 0.35],
  [13, 1.3, -0.42, 0.6],
  [40, 1.3, -0.42, 0.6],
];
function reach(x: number, k: 1 | 2 | 3) {
  let i = 0;
  while (i < REACH.length - 2 && REACH[i + 1][0] < x) i++;
  const a = REACH[i];
  const b = REACH[i + 1];
  return a[k] + (b[k] - a[k]) * smooth(a[0], b[0], x);
}
/** How fast this stretch runs, relative to the run. */
export const reachSpeed = (x: number) => reach(x, 1);
/** 0 for glassy pool, 1 for whitewater. */
export const reachChop = (x: number) => reach(x, 3);

/** The fastest thread, as a fraction of half-width, swung to the outside of the bend. */
const thread = (x: number) => Math.max(-0.45, Math.min(0.45, -riverCurve(x) * 5.5));
/** Where z sits across the channel: 0 on the thread, ±1 at the banks. */
export function lane(x: number, z: number) {
  const u = (z - riverZ(x)) / riverHalf(x);
  const t = thread(x);
  return u > t ? (u - t) / (1 - t) : (u - t) / (1 + t);
}
/** The z at lane position v (see `lane`) across the stream at x. */
export function laneZ(x: number, v: number) {
  const t = thread(x);
  return riverZ(x) + (v > 0 ? t + v * (1 - t) : t + v * (1 + t)) * riverHalf(x);
}
/** Stream bed height: deepest under the thread, shelving up to the banks. */
export function bedY(x: number, z: number) {
  const d = reach(x, 2);
  const v = Math.min(1, Math.abs(lane(x, z)));
  return d + (-0.1 - d) * v ** 2.4;
}
/** A name for the water at x, for the status line. */
export function waterName(x: number) {
  if (x < -11.5) return 'the rapids';
  if (x < -4.5) return 'the riffle';
  if (x < 3.6) return 'the run';
  if (x < 9.8) return 'the pool';
  return 'the tailout';
}

const C = {
  grass: ['#a2d65c', '#97cb53', '#abdc66', '#8cc04d'],
  blades: ['#6fae45', '#7dbb4c', '#5f9e3c', '#8cc457'],
  soil: '#a8764a',
  granite: ['#a7adb6', '#949ba5', '#b9b2a6', '#868d97'],
  snow: '#f3f7fa',
  foam: '#ffffff',
  trunk: '#7a4f2c',
  pine: ['#2f8f4e', '#2a7d45', '#3a9d57'],
  aspenTrunk: '#ece6da',
  aspen: ['#f2c14e', '#e9a93a', '#b9d64a'],
  willow: '#6fae4a',
  tuft: '#5fa83a',
  boulder: ['#a9b0b8', '#bcc2c8', '#8b939d', '#9d968a'],
  moss: '#7fa84a',
  // Creek stones: granite, red sandstone, green and purple shale, quartz.
  stones: ['#a48a64', '#8a6a4a', '#6f7c86', '#9a5a44', '#66704e', '#7d7088', '#55606b', '#b4a88c', '#8e8f86', '#c9c2b4'],
  flowers: ['#8f6bff', '#ff5a4e', '#ffd23f', '#ffffff', '#b38cff'],
  dirt: ['#b98d5f', '#ad8254', '#c29a6c'],
  rut: '#94693f',
  pebbles: ['#9aa3ad', '#b5ab98', '#7f878f'],
  bark: ['#6b4a2e', '#5c3f27', '#7a5636'],
  deadwood: '#a39a8a',
  roots: '#4f3622',
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map<string, THREE.MeshLambertMaterial>();
function mat(color: string, flat = false) {
  const key = flat ? color + 'f' : color;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: flat });
    matCache.set(key, m);
  }
  return m;
}

/** A box mesh centered at (x, y, z). */
export function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(boxGeo, mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// Seeded so the layout is the same every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A lumpy, low-poly stone of radius about 1. The bumps are a function of
    position, so the faces still meet where the polyhedron repeats a vertex. */
function lumpGeo(seed: number, detail = 1, amp = 0.2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 2.3 + seed) * Math.sin(v.y * 3.1 + seed * 1.7) * Math.sin(v.z * 2.7 + seed * 0.6);
    v.multiplyScalar(1 + n * amp + Math.sin(v.x * 5.1 + v.z * 4.3 + seed) * amp * 0.25);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
const STONE_GEOS = [11, 23, 37, 51].map((s, i) => lumpGeo(s, i % 2 ? 1 : 0, 0.22));
const stoneMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });

/** A lumpy stone mesh, for boulders and the macro view. */
export function lump(color: string, sx: number, sy: number, sz: number, seed = 0, detail = 1) {
  const m = new THREE.Mesh(lumpGeo(seed, detail, 0.2), mat(color, true));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

interface Block { x: number; y: number; z: number; w: number; h: number; d: number; ry?: number; color: string }
interface Stone { x: number; y: number; z: number; s: number; sy: number; sz: number; ry: number; tilt: number; color: string }

/** Lots of static boxes as one instanced mesh per color. */
function instanced(list: Block[], group: THREE.Group, shadow: boolean) {
  const byColor = new Map<string, Block[]>();
  for (const b of list) byColor.set(b.color, [...(byColor.get(b.color) ?? []), b]);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [color, blocks] of byColor) {
    const inst = new THREE.InstancedMesh(boxGeo, mat(color), blocks.length);
    blocks.forEach((b, i) => {
      q.setFromAxisAngle(up, b.ry ?? 0);
      m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = shadow;
    inst.receiveShadow = true;
    group.add(inst);
  }
}

/** Rounded stones, instanced across a few lumpy shapes with a color each. */
function stones(list: Stone[], group: THREE.Group, shadow: boolean, rand: () => number) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  STONE_GEOS.forEach((geo, gi) => {
    const mine = list.filter((_, i) => i % STONE_GEOS.length === gi);
    const inst = new THREE.InstancedMesh(geo, stoneMat, mine.length);
    mine.forEach((s, i) => {
      q.setFromEuler(e.set(s.tilt, s.ry, s.tilt * 0.6));
      m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.s, s.sy, s.sz));
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, col.set(s.color).multiplyScalar(0.9 + rand() * 0.2));
    });
    inst.castShadow = shadow;
    inst.receiveShadow = true;
    group.add(inst);
  });
}

export interface Terrain {
  group: THREE.Group;
  rocks: { x: number; z: number; r: number }[];
  /** A log you can cast under, where a big fish lives. */
  logLie: { x: number; z: number };
  /** Trees behind the angler tall enough to stand in front of the water
      in the reverse view, which hides them. */
  screen: THREE.Object3D;
  /** Animate the chop and the foam. */
  update: (t: number) => void;
}

const clampIdx = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v)));

/** The far bank climbs in granite steps toward the peaks behind the angler. */
const lift = (side: number, row: number) => (side < 0 && row >= 2 ? Math.floor(row / 2) * 0.7 : 0);

interface Foam { x: number; z: number; s: number; ry: number; rate: number }

/** `polar` is the camera's tilt from straight down, to work out which trees would block the reverse view. */
export function buildTerrain(polar: number): Terrain {
  const rand = rng(7);
  const pickOf = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const group = new THREE.Group();
  const SPAN = 26;
  const COL = 0.5;
  const ground: Block[] = [];
  const bottom = BANK_Y - 1.1;
  const inWall = (x: number) => x < WALL_X + 0.3;
  const inRoots = (x: number) => x > LOGFALL_X - 0.4 && x < LOGFALL_X + 2.4;

  // Bank tiles in half-unit columns that step along with the stream: a
  // grass cap on soil, or on granite where the hillside climbs. The cap is
  // tinted in drifts so the meadow is patchy rather than striped.
  const meadow = (x: number, z: number) => {
    const n = Math.sin(x * 0.45 + z * 0.3) + Math.sin(x * 0.17 - z * 0.61 + 2) + (rand() - 0.5) * 0.9;
    return C.grass[clampIdx((n + 2) * 1.1, C.grass.length)];
  };
  const shore: Stone[] = [];
  for (let row = 0; row < 12; row++) {
    for (const side of [-1, 1]) {
      for (let x = -SPAN; x <= SPAN; x += COL) {
        const z = edgeZ(side, x) + side * (0.5 + row);
        const top = BANK_Y + lift(side, row);
        // Now and then the near bank breaks down to a little gravel beach.
        if (row === 0 && side > 0 && rand() < 0.1) {
          ground.push({ x, y: (BANK_Y - 0.3 + bottom) / 2, z, w: COL, h: BANK_Y - 0.3 - bottom, d: 1, color: C.soil });
          for (let k = 0; k < 4; k++) {
            const s = 0.07 + rand() * 0.08;
            shore.push({ x: x + (rand() - 0.5) * 0.45, y: BANK_Y - 0.3, z: z + (rand() - 0.5) * 0.9, s, sy: s * 0.5, sz: s * 0.8, ry: rand() * 3, tilt: 0, color: pickOf(C.stones) });
          }
          continue;
        }
        for (const sz of [-0.25, 0.25]) {
          const snow = side < 0 && (row >= 10 || (row === 9 && rand() < 0.4));
          ground.push({ x, y: top - 0.1, z: z + sz, w: COL, h: 0.2, d: 0.5, color: snow ? C.snow : meadow(x, z + sz) });
        }
        // Mottled granite where the hill steps up, so a ledge doesn't read as a road.
        const base = lift(side, row) > 0 ? pickOf(C.granite) : C.soil;
        ground.push({ x, y: (top - 0.2 + bottom) / 2, z, w: COL, h: top - 0.2 - bottom, d: 1, color: base });
      }
    }
  }
  instanced(ground, group, false);

  // Dirt singletrack: worn a little into the grass, with a darker line where
  // the tires run, and stones kicked to the edges.
  const trail: Block[] = [];
  for (let x = -SPAN; x <= SPAN; x += 0.25) {
    const z = trailZ(x);
    const ry = -Math.atan((trailZ(x + 0.1) - trailZ(x - 0.1)) / 0.2);
    trail.push({ x, y: BANK_Y + 0.006, z, w: 0.29, h: 0.02, d: 0.6 + rand() * 0.12, ry, color: pickOf(C.dirt) });
    trail.push({ x, y: BANK_Y + 0.018, z: z + (rand() - 0.5) * 0.04, w: 0.29, h: 0.01, d: 0.12, ry, color: C.rut });
    if (rand() < 0.3) {
      const e = (rand() < 0.5 ? -1 : 1) * (0.3 + rand() * 0.08);
      const s2 = 0.05 + rand() * 0.06;
      trail.push({ x: x + rand() * 0.2, y: BANK_Y + 0.03, z: z + e, w: s2, h: 0.05, d: s2, ry: rand(), color: pickOf(C.pebbles) });
    }
  }
  instanced(trail, group, false);

  // Grass blades and pebbles over the low banks.
  const blades: Block[] = [];
  for (let row = 0; row < 7; row++) {
    for (const side of [-1, 1]) {
      const y = BANK_Y + lift(side, row);
      for (let x = -SPAN; x <= SPAN; x++) {
        for (let k = 0; k < 3; k++) {
          const bx = x + rand() - 0.5;
          const bz = edgeZ(side, bx) + side * (0.5 + row) + rand() - 0.5;
          if (side > 0 && Math.abs(bz - trailZ(bx)) < 0.42) continue;
          if (side < 0 && inWall(bx)) continue;
          const h = 0.06 + rand() * 0.12;
          if (rand() < 0.12) blades.push({ x: bx, y: y + 0.02, z: bz, w: 0.06, h: 0.04, d: 0.05, ry: rand(), color: C.pebbles[Math.floor(rand() * 3)] });
          else blades.push({ x: bx, y: y + h / 2, z: bz, w: 0.03, h, d: 0.03, ry: rand(), color: pickOf(C.blades) });
        }
      }
    }
  }
  instanced(blades, group, false);

  // The bed and the water are strips that follow the channel: x every
  // quarter unit, `across` steps from bank to bank.
  const strip = (pad: number, across: number, at: (x: number, z: number, t: number, i: number) => void) => {
    const cols = Math.round((SPAN * 2) / 0.25) + 1;
    const pos = new Float32Array(cols * (across + 1) * 3);
    let n = 0;
    for (let i = 0; i < cols; i++) {
      const x = -SPAN + i * 0.25;
      for (let j = 0; j <= across; j++) {
        const t = -1 - pad + ((2 + 2 * pad) * j) / across;
        const z = riverZ(x) + t * riverHalf(x);
        pos[n * 3] = x;
        pos[n * 3 + 2] = z;
        at(x, z, t, n);
        n++;
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < cols - 1; i++) {
      for (let j = 0; j < across; j++) {
        const a = i * (across + 1) + j;
        const b = a + across + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  };

  // Gravel bed: tan in the shallows, going to slate where it's deep.
  const shallowBed = new THREE.Color('#a39773');
  const midBed = new THREE.Color('#7b8269');
  const deepBed = new THREE.Color('#3f5d62');
  const bedCols: number[] = [];
  const bedYs: number[] = [];
  const bedGeo = strip(0.3, 22, (x, z, t, n) => {
    const y = Math.abs(t) > 1 ? -0.1 : bedY(x, z) + (rand() - 0.5) * 0.05;
    bedYs[n] = y;
    const k = smooth(-0.1, -1.2, y);
    const c = k < 0.5 ? shallowBed.clone().lerp(midBed, k * 2) : midBed.clone().lerp(deepBed, k * 2 - 1);
    c.multiplyScalar(0.92 + rand() * 0.16);
    bedCols.push(c.r, c.g, c.b);
  });
  {
    const p = bedGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, bedYs[i]);
    bedGeo.setAttribute('color', new THREE.Float32BufferAttribute(bedCols, 3));
    bedGeo.computeVertexNormals();
    const bed = new THREE.Mesh(bedGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    bed.receiveShadow = true;
    group.add(bed);
  }

  // River rocks, rounded and every color a creek turns up. More of them,
  // and bigger, where the water runs shallow and quick.
  const bedStones: Stone[] = [];
  for (let i = 0; i < 1700; i++) {
    const x = -SPAN + rand() * SPAN * 2;
    const t = (rand() * 2 - 1) * 0.98;
    const z = riverZ(x) + t * riverHalf(x);
    const chop = reachChop(x);
    if (rand() > 0.45 + chop * 0.55) continue;
    const s = 0.05 + rand() ** 2 * (0.16 + chop * 0.14);
    const sy = s * (0.4 + rand() * 0.25);
    bedStones.push({ x, y: bedY(x, z) + sy * 0.3, z, s, sy, sz: s * (0.65 + rand() * 0.4), ry: rand() * Math.PI, tilt: (rand() - 0.5) * 0.3, color: pickOf(C.stones) });
  }
  stones(bedStones, group, false, rand);

  // Stones along the waterline, half in and half out, and a gravel bar on
  // the inside of the bend.
  for (const side of [-1, 1]) {
    for (let x = -SPAN; x <= SPAN; x += 0.2 + rand() * 0.25) {
      if (rand() < 0.25) continue;
      const bar = side < 0 && x > 2 && x < 10 ? 1 : 0;
      const n = 1 + bar * 2;
      for (let k = 0; k < n; k++) {
        const s = 0.1 + rand() * 0.16;
        const z = edgeZ(side, x) - side * (0.05 + rand() * (0.2 + bar * 0.5));
        shore.push({ x: x + rand() * 0.1, y: -0.05 + rand() * 0.06, z, s, sy: s * 0.55, sz: s * 0.8, ry: rand() * 3, tilt: (rand() - 0.5) * 0.4, color: pickOf(C.stones) });
      }
    }
  }
  stones(shore, group, true, rand);

  // Granite boulders breaking the current, rounded and moss-capped, with
  // whitewater spilling off them. [x, across, radius].
  const rocks: Terrain['rocks'] = [];
  const foamBase: Foam[] = [];
  const foamAt = (x: number, z: number, s: number, rate = 2.2) => foamBase.push({ x, z, s, ry: -Math.atan(riverSlope(x)) + (rand() - 0.5) * 0.3, rate });
  const boulder = (x: number, z: number, r: number) => {
    const g = new THREE.Group();
    const by = bedY(x, z);
    const top = 0.2 + rand() * 0.22;
    const h = (top - by) / 2;
    g.add(lump(pickOf(C.boulder), r * 1.1, h * 1.15, r * 0.95, rand() * 10).translateY(by + h));
    g.add(lump(pickOf(C.boulder), r * 0.6, h * 0.8, r * 0.55, rand() * 10).translateX(-r * 0.6).translateZ(r * 0.45).translateY(by + h * 0.7));
    if (rand() < 0.6) g.add(lump(C.moss, r * 0.65, 0.07, r * 0.55, rand() * 10, 0).translateY(top + 0.05).translateX(-r * 0.15));
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI;
    group.add(g);
    rocks.push({ x, z, r });
    // A pillow on the upstream face, a tongue of white below.
    const sl = riverSlope(x);
    foamAt(x - r * 1.05, z - sl * r, r * 1.4);
    for (let k = 0; k < 4; k++) {
      const d = r + 0.15 + k * 0.32;
      foamAt(x + d, z + sl * d + (rand() - 0.5) * r * 1.2, r * (1.1 - k * 0.2));
    }
  };
  for (const [x, u, r] of [
    // the rapids
    [-11.4, 0.15, 0.5], [-12.7, -0.45, 0.6], [-14.3, 0.5, 0.55], [-15.9, -0.05, 0.62], [-17.6, 0.45, 0.5], [-19.2, -0.35, 0.6], [-21.5, 0.2, 0.55],
    // the riffle and the run
    [-8.6, -0.25, 0.4], [-7, 0.4, 0.34], [-5.5, -0.45, 0.48], [-3.6, -0.75, 0.3], [-1.6, 0.4, 0.38], [2.4, -0.2, 0.55],
    // the head of the pool, the tailout
    [4.6, 0.65, 0.32], [6.4, 0.1, 0.42], [10.4, -0.45, 0.45], [12.2, 0.3, 0.4], [16.5, -0.3, 0.45], [20, 0.35, 0.5],
  ] as const) boulder(x, riverZ(x) + u * riverHalf(x), r);

  // Stones poking out of the riffles, each with a little white behind.
  const peeks: Stone[] = [];
  for (let i = 0; i < 160; i++) {
    const x = -SPAN + rand() * SPAN * 2;
    const chop = reachChop(x);
    if (rand() > chop - 0.25) continue;
    const z = riverZ(x) + (rand() * 2 - 1) * 0.85 * riverHalf(x);
    const s = 0.12 + rand() * 0.16;
    peeks.push({ x, y: 0.02 + rand() * 0.04, z, s, sy: s * 0.5, sz: s * 0.8, ry: rand() * 3, tilt: 0, color: pickOf(C.stones) });
    foamAt(x + s + 0.06, z + riverSlope(x) * s, s * 1.2, 4);
  }
  stones(peeks, group, true, rand);

  // Standing waves through the rapids, and chop flecks on the riffles.
  for (let x = -SPAN; x < -10.5; x += 0.45 + rand() * 0.25) {
    const h = riverHalf(x);
    for (let t = -0.8; t <= 0.8; t += 0.22 + rand() * 0.2) foamAt(x, riverZ(x) + t * h, 0.2 + rand() * 0.3, 5);
  }
  for (let i = 0; i < 420; i++) {
    const x = -SPAN + rand() * SPAN * 2;
    if (rand() > reachChop(x) * 0.9) continue;
    foamAt(x, riverZ(x) + (rand() * 2 - 1) * 0.8 * riverHalf(x), 0.06 + rand() * 0.1, 6 + rand() * 4);
  }
  // Foam where the water meets the banks.
  for (let x = -SPAN; x <= SPAN; x += 0.8) {
    for (const side of [-1, 1]) if (rand() < 0.5) foamAt(x + rand() * 0.2, edgeZ(side, x) - side * 0.25, 0.15 + rand() * 0.2);
  }

  // A spruce down off the outside bank of the pool: a big fish lives under it.
  const sweeper = new THREE.Group();
  sweeper.add(box(2.6, 0.24, 0.24, C.trunk, 0, 0, 0));
  sweeper.add(box(0.46, 0.46, 0.46, C.roots, 1.35, 0.05, 0));
  for (const [bx, bz, l] of [[-0.3, 0.2, 0.4], [-0.9, -0.18, 0.35], [0.4, 0.2, 0.3]] as const) sweeper.add(box(0.05, 0.05, l, C.deadwood, bx, 0.06, bz));
  const sx = 6.9;
  const sz = edgeZ(1, sx) - 1;
  sweeper.position.set(sx, 0.08, sz);
  sweeper.rotation.set(0, -0.45, 0.05);
  group.add(sweeper);
  for (let k = 0; k < 3; k++) foamAt(sx - 1.2 + k * 0.35, sz - 0.7 + k * 0.1, 0.3 - k * 0.06);
  const logLie = { x: sx - 0.6, z: sz - 0.9 };

  const flora: Block[] = [];
  const screenTrees = new Set<THREE.Object3D>();
  const tree = (x: number, y: number, z: number, aspenOdds: number) => {
    const t = rand() < aspenOdds ? aspen(x, y, z, rand) : pine(x, y, z, rand);
    group.add(t);
    const top = y + t.userData.h;
    if (z < riverZ(x) && top * Math.sin(polar) - (bankZ(x) - z) * Math.cos(polar) > -0.3) screenTrees.add(t);
  };

  // Upstream, the river comes boiling round a granite wall. It stands on his
  // bank and juts into the stream, so the rapids squeeze past the buttress.
  const wall: Block[] = [];
  for (let x = WALL_X; x > -SPAN - 1; ) {
    const w = 0.7 + rand() * 0.5;
    const cx = x - w / 2;
    const e = edgeZ(-1, cx);
    const jut = cx > -16.5 ? 1.0 + rand() * 0.35 : 0.3 + rand() * 0.3;
    for (let d = -jut; d < 9.5; ) {
      const dd = 0.75 + rand() * 0.45;
      const z = e - d - dd / 2;
      const top = BANK_Y + lift(-1, Math.max(0, Math.floor(d))) + 1.6 + Math.min(Math.max(d, 0), 6) * 0.25 + rand() * 1.0 + (cx > WALL_X - 1.4 ? 0.7 : 0);
      let y = d < 0 ? BED_Y : BANK_Y - 0.2;
      let inset = 0;
      while (y < top - 0.05) {
        const h = Math.min(top - y, 0.5 + rand() * 0.8);
        wall.push({ x: cx + (rand() - 0.5) * 0.08, y: y + h / 2, z, w: w - inset, h, d: dd - inset, ry: (rand() - 0.5) * 0.1, color: pickOf(C.granite) });
        y += h;
        inset = Math.min(0.25, inset + rand() * 0.1);
      }
      // Grass in the cracks on top, snow up high, a pine where there's soil.
      wall.push({ x: cx, y: top + 0.03, z, w: (w - inset) * 0.9, h: 0.06, d: (dd - inset) * 0.9, color: top > 4.2 ? C.snow : meadow(cx, z) });
      if (d > 1.5 && rand() < 0.12) tree(cx, top + 0.06, z, 0);
      d += dd;
    }
    if (cx > -18) {
      foamAt(cx + 0.2, e + jut + 0.15, 0.5, 5);
      foamAt(cx + 0.5, e + jut + 0.45, 0.4, 5);
    }
    x -= w;
  }
  instanced(wall, group, true);
  rocks.push({ x: WALL_X - 0.8, z: edgeZ(-1, WALL_X) + 0.7, r: 0.8 });

  // Downstream, a giant spruce has come down across the whole river, roots
  // and all. The root plate stands on his bank; the trunk reaches the trail.
  {
    const x0 = LOGFALL_X + 0.6;
    const z0 = edgeZ(-1, x0) - 0.7;
    const x1 = x0 + 4.2;
    const z1 = edgeZ(1, x1) + 0.55;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const fall = new THREE.Group();
    const R = 0.36;
    // The trunk, in sections of bark, sagging a little over the water.
    for (let s = 0; s < len; s += 0.55) {
      const l = Math.min(0.56, len - s);
      const mid = s + l / 2;
      const y = 0.78 - (mid / len) * 0.2 - Math.sin((Math.PI * mid) / len) * 0.12;
      const taper = 1 - (mid / len) * 0.35;
      fall.add(box(l, R * 2 * taper, R * 2 * taper, pickOf(C.bark), mid, y, 0));
      if (rand() < 0.4) fall.add(box(l * 0.6, 0.05, R * taper, C.moss, mid, y + R * taper, (rand() - 0.5) * 0.2, false));
      if (rand() < 0.45) {
        // Snapped-off limbs, some stabbing down into the current.
        const b = box(0.07, 0.5 + rand() * 0.5, 0.07, C.deadwood, mid, y, 0);
        b.rotation.set((rand() - 0.5) * 1.6, 0, (rand() - 0.5) * 1.2);
        b.position.y += Math.cos(b.rotation.x) * 0.3 * (rand() < 0.5 ? -1 : 1);
        fall.add(b);
      }
    }
    // The root plate: a ring of torn roots around a disc of dirt and stones.
    const plate = new THREE.Group();
    plate.add(box(0.4, 2.1, 2.3, C.roots, 0, 0, 0));
    plate.add(box(0.42, 1.5, 1.7, '#7a5a3a', -0.03, 0.1, 0));
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + rand() * 0.3;
      const r0 = 1.05 + rand() * 0.15;
      const root = box(0.14, 0.12, 0.5 + rand() * 0.4, C.roots, 0, Math.sin(a) * r0, Math.cos(a) * r0);
      root.rotation.x = -a;
      plate.add(root);
    }
    for (let k = 0; k < 6; k++) plate.add(lump(pickOf(C.stones), 0.12 + rand() * 0.1, 0.1, 0.12, rand() * 9, 0).translateX(-0.22).translateY((rand() - 0.5) * 1.4).translateZ((rand() - 0.5) * 1.6));
    plate.position.set(-0.1, 0.95, 0);
    fall.add(plate);
    fall.position.set(x0, BANK_Y - 0.25, z0);
    fall.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    group.add(fall);
    // The hole the roots tore out of the bank.
    group.add(box(1.4, 0.1, 2.0, '#6b4a2e', x0 - 0.2, BANK_Y + 0.0, z0 - 0.1, false));
    // A second, older log jammed against it in the water, with foam piled behind.
    const jam = new THREE.Group();
    jam.add(box(3.6, 0.22, 0.22, '#5c4632', 0, 0, 0));
    jam.add(box(0.06, 0.06, 0.5, C.deadwood, -0.6, 0.08, 0.2));
    const jx = x0 + 1.6;
    const jz = riverZ(jx) - 0.3;
    jam.position.set(jx, 0.02, jz);
    jam.rotation.y = -Math.atan2(z1 - z0, x1 - x0) + 0.15;
    group.add(jam);
    for (let k = -4; k <= 4; k++) {
      const t = k / 4;
      const fx = jx - 0.4 + t * 1.2 * Math.cos(jam.rotation.y);
      foamAt(fx - 0.25, jz - t * 1.6, 0.35, 3);
    }
    rocks.push({ x: jx, z: jz, r: 0.6 });
  }

  // Pines and golden aspens, willows and wildflowers. Keep the near bank low
  // so nothing blocks the water, and leave a clearing where the angler stands.
  for (let row = 0; row < 12; row++) {
    for (const side of [-1, 1]) {
      const y = BANK_Y + lift(side, row);
      for (let x = -SPAN; x <= SPAN; x++) {
        const z = edgeZ(side, x) + side * (0.5 + row);
        const near = side > 0;
        const clearing = !near && row < 2 && Math.abs(x) <= 2;
        const r = rand();
        if ((near && row === PATH_ROW) || clearing) continue;
        if (!near && (inWall(x) || (inRoots(x) && row < 4))) continue;
        if (row === 0) {
          if (r < 0.12 && near) flora.push({ x: x + rand() - 0.5, y: y + 0.18, z: z - side * 0.2, w: 0.5, h: 0.36, d: 0.45, color: C.willow });
          else if (r < 0.35) {
            for (let k = 0; k < 3; k++) {
              const h = 0.16 + rand() * 0.18;
              const tx = x - 0.3 + rand() * 0.6;
              flora.push({ x: tx, y: y + h / 2, z: edgeZ(side, tx) + side * (0.6 + rand() * 0.3), w: 0.05, h, d: 0.05, color: C.tuft });
            }
          }
          continue;
        }
        const treeOdds = near ? (row < 3 ? 0 : 0.1) : row === 1 ? 0.15 : 0.32;
        if (r < treeOdds) tree(x, y, z, 0.3);
        else if (r < treeOdds + 0.04) {
          const s = 0.4 + rand() * 0.35;
          const m = lump(pickOf(C.boulder), s * 0.55, s * 0.4, s * 0.48, rand() * 9);
          m.position.set(x, y + s * 0.12, z);
          group.add(m);
        } else if (r < treeOdds + 0.22) {
          const c = pickOf(C.flowers);
          const fx = x + rand() - 0.5;
          const fz = z + rand() - 0.5;
          flora.push({ x: fx, y: y + 0.07, z: fz, w: 0.03, h: 0.14, d: 0.03, color: C.tuft });
          flora.push({ x: fx, y: y + 0.18, z: fz, w: 0.07, h: 0.1, d: 0.07, color: c });
        }
      }
    }
  }
  instanced(flora, group, true);

  // The water's surface, tinted by what's under it: pale over the gravel,
  // deep green-blue in the pool, white-streaked where it breaks.
  const shallowW = new THREE.Color('#8ee6ee');
  const deepW = new THREE.Color('#1f8ea6');
  const whiteW = new THREE.Color('#e6fbfd');
  const wCols: number[] = [];
  const chopV: { i: number; k: number; x: number; z: number }[] = [];
  const waterGeo = strip(0.08, 16, (x, z, _t, n) => {
    const depth = -bedY(x, z);
    const chop = reachChop(x) * (1 - Math.min(1, Math.abs(lane(x, z))) ** 2 * 0.6);
    const k = smooth(0.1, 1.15, depth);
    const c = shallowW.clone().lerp(deepW, k).lerp(whiteW, chop * 0.4);
    wCols.push(c.r, c.g, c.b, 0.34 + k * 0.38 + chop * 0.12);
    if (chop > 0.08) chopV.push({ i: n, k: chop, x, z });
  });
  waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(wCols, 4));
  const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, flatShading: true }));
  water.receiveShadow = true;
  water.renderOrder = 2;
  group.add(water);

  const foam = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({ color: C.foam, transparent: true, opacity: 0.85 }), foamBase.length);
  foam.renderOrder = 3;
  group.add(foam);
  const wpos = waterGeo.attributes.position as THREE.BufferAttribute;
  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fv = new THREE.Vector3();
  const fs = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const update = (t: number) => {
    // Chop: the surface heaves where the stream breaks, so the facets catch the light.
    for (const v of chopV) wpos.setY(v.i, v.k * 0.05 * Math.sin(t * (5 + v.k * 4) + v.x * 5.3 + v.z * 3.7));
    wpos.needsUpdate = true;
    foamBase.forEach((b, i) => {
      const bob = 0.7 + Math.sin(t * b.rate + b.x * 1.7 + b.z) * 0.3;
      fm.compose(fv.set(b.x, 0.02, b.z), fq.setFromAxisAngle(up, b.ry), fs.set(b.s * bob, 0.05, 0.16 * bob));
      foam.setMatrixAt(i, fm);
    });
    foam.instanceMatrix.needsUpdate = true;
  };
  update(0);

  const screen = bake(group, screenTrees, new Set<THREE.Object3D>([water]));
  return { group, rocks, logLie, screen, update };
}

/** Hundreds of little static boxes and lumps are hundreds of draw calls. Merge
    them by material into a handful of meshes. Meshes under `apart` go into a
    separate group (returned) so it can be hidden on its own; `skip` stays as is. */
function bake(group: THREE.Group, apart: Set<THREE.Object3D>, skip: Set<THREE.Object3D>) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; split: boolean; geos: THREE.BufferGeometry[] }>();
  const done: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D, split: boolean) => {
    split ||= apart.has(o);
    if (skip.has(o)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material) && !m.material.transparent) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}|${split}|${!!g.attributes.color}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, split, geos: [] }));
      b.geos.push(g);
      done.push(m);
    }
    for (const c of o.children) walk(c, split);
  };
  walk(group, false);
  for (const m of done) m.removeFromParent();
  // Drop the groups that are empty now.
  const prune = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      prune(c);
      if (c.type === 'Group' && !c.children.length) c.removeFromParent();
    }
  };
  prune(group);
  const screen = new THREE.Group();
  group.add(screen);
  for (const b of buckets.values()) {
    const merged = new THREE.Mesh(mergeGeometries(b.geos)!, b.mat);
    merged.castShadow = b.cast;
    merged.receiveShadow = b.recv;
    (b.split ? screen : group).add(merged);
    for (const g of b.geos) g.dispose();
  }
  return screen;
}

function pine(x: number, y: number, z: number, rand: () => number) {
  const g = new THREE.Group();
  const trunkH = 0.3 + rand() * 0.25;
  g.add(box(0.22, trunkH, 0.22, C.trunk, 0, trunkH / 2, 0));
  const tiers = 3 + Math.floor(rand() * 2);
  const base = 0.95 + rand() * 0.2;
  let ty = trunkH;
  for (let i = 0; i < tiers; i++) {
    const s = base * (1 - i / (tiers + 0.6));
    const tier = box(s, 0.42, s, C.pine[i % 3], (rand() - 0.5) * 0.06, ty + 0.21, (rand() - 0.5) * 0.06);
    tier.rotation.y = rand() * 0.7;
    g.add(tier);
    ty += 0.36;
  }
  g.add(box(0.14, 0.2, 0.14, C.pine[0], 0, ty + 0.1, 0));
  g.position.set(x, y, z);
  g.userData.h = ty + 0.2;
  return g;
}

function aspen(x: number, y: number, z: number, rand: () => number) {
  const g = new THREE.Group();
  const trunkH = 0.9 + rand() * 0.4;
  g.add(box(0.16, trunkH, 0.16, C.aspenTrunk, 0, trunkH / 2, 0));
  g.add(box(0.17, 0.05, 0.17, '#3b3b3b', 0, trunkH * 0.4, 0, false));
  const leaf = C.aspen[Math.floor(rand() * C.aspen.length)];
  g.add(box(0.75, 0.55, 0.75, leaf, 0, trunkH + 0.2, 0));
  g.add(box(0.5, 0.35, 0.5, leaf, 0.08, trunkH + 0.62, -0.05));
  g.add(box(0.3, 0.25, 0.3, leaf, -0.25, trunkH + 0.05, 0.2));
  g.position.set(x, y, z);
  g.userData.h = trunkH + 0.8;
  return g;
}

export interface FishPalette { back: string; side: string; stripe: string; belly: string; fin: string; spots: boolean; throat?: string }

export type SpeciesId = 'brook' | 'rainbow' | 'cutthroat' | 'brown' | 'golden';

export const FISH_PALETTES: Record<SpeciesId, FishPalette> = {
  rainbow: { back: '#6c8f3a', side: '#e9efe2', stripe: '#ff5c8a', belly: '#ffffff', fin: '#a9bd76', spots: true },
  brook: { back: '#3d6638', side: '#78a862', stripe: '#ffe86a', belly: '#ff8a3d', fin: '#ff7a3d', spots: false },
  brown: { back: '#8f6a2c', side: '#f5bd4f', stripe: '#ff5a3a', belly: '#fff0c2', fin: '#d39a3d', spots: true },
  cutthroat: { back: '#6f7a3a', side: '#e6c88a', stripe: '#efb3a2', belly: '#fff4dc', fin: '#c9b06a', spots: true, throat: '#ff3b2f' },
  golden: { back: '#c08a1e', side: '#ffd23a', stripe: '#ff4a3a', belly: '#ff6a3a', fin: '#ff8a3d', spots: false },
};

export interface FishMesh {
  root: THREE.Group;
  tail: THREE.Group;
}

/** A voxel trout, nose toward +x, about `len` long. */
export function buildFish(len: number, palette = FISH_PALETTES.rainbow): FishMesh {
  const root = new THREE.Group();
  const h = len * 0.32;
  const w = len * 0.24;
  const seg = (x: number, l: number, s: number, parent: THREE.Object3D) => {
    parent.add(box(l, h * s * 0.5, w * s, palette.side, x, 0, 0));
    parent.add(box(l, h * s * 0.22, w * s * 0.9, palette.back, x, h * s * 0.36, 0));
    parent.add(box(l, h * s * 0.24, w * s * 0.9, palette.belly, x, -h * s * 0.36, 0));
    parent.add(box(l * 0.98, h * s * 0.1, w * s + 0.004, palette.stripe, x, 0.02 * len, 0, false));
    if (palette.spots) {
      for (const [dx, dy] of [[-0.25, 0.3], [0.2, 0.42], [0.05, 0.18]]) {
        for (const sz of [-1, 1]) parent.add(box(len * 0.025, len * 0.025, 0.004, '#1e1e1e', x + l * dx, h * s * dy, sz * (w * s * 0.5 + 0.002), false));
      }
    }
  };
  seg(len * 0.28, len * 0.22, 0.85, root);
  seg(len * 0.06, len * 0.24, 1, root);
  root.add(box(len * 0.04, len * 0.05, w * 0.9, '#1e1e1e', len * 0.33, h * 0.12, 0, false));
  root.add(box(len * 0.08, h * 0.35, len * 0.02, palette.fin, len * 0.02, h * 0.55, 0));
  // The red slash under a cutthroat's jaw.
  if (palette.throat) for (const sz of [-1, 1]) root.add(box(len * 0.12, h * 0.08, 0.006, palette.throat, len * 0.3, -h * 0.3, sz * w * 0.4, false));
  const tail = new THREE.Group();
  tail.position.x = -len * 0.06;
  seg(-len * 0.12, len * 0.24, 0.72, tail);
  tail.add(box(len * 0.06, h * 1.0, w * 0.18, palette.fin, -len * 0.27, 0, 0));
  root.add(tail);
  // A fish is a few dozen boxes; bake the body and tail into a mesh or two each.
  const none = new Set<THREE.Object3D>();
  bake(tail, none, none).removeFromParent();
  bake(root, none, new Set([tail])).removeFromParent();
  return { root, tail };
}

export interface Avatar {
  root: THREE.Group;
  body: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  rod: THREE.Group;
  rodUpper: THREE.Group;
  rodTip: THREE.Object3D;
  hands: THREE.Object3D;
  legs: THREE.Group[];
}

/** Hudson, as seen on a September river: gray cap, mirrored shades, ginger
    mustache, orange sun shirt, gray vest, waders, and a net on his back.
    Faces -z with feet at the origin; the game turns him to face the camera. */
export function buildAvatar(): Avatar {
  const K = {
    skin: '#f1c4a3',
    skinDark: '#e6aa86',
    stubble: '#d9a27a',
    stache: '#b5702f',
    hair: '#9b6a43',
    cap: '#7d8088',
    capDark: '#666970',
    shades: '#22d3b6',
    frame: '#2a2a2a',
    gaiter: '#a9bccf',
    shirt: '#ffab2e',
    vest: '#8d9299',
    vestDark: '#73787f',
    waders: '#5c6770',
    boots: '#3b3f45',
    net: '#d9b45a',
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Legs and boots, hinged at the hip so he can walk the bank.
  const legs = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.11, 0.37, 0);
    g.add(box(0.17, 0.34, 0.2, K.waders, 0, -0.17, 0));
    g.add(box(0.19, 0.08, 0.25, K.boots, 0, -0.33, -0.02));
    body.add(g);
    return g;
  });
  // Torso, wader bib, vest.
  body.add(box(0.46, 0.42, 0.28, K.shirt, 0, 0.58, 0));
  body.add(box(0.4, 0.12, 0.3, K.waders, 0, 0.42, 0));
  body.add(box(0.44, 0.3, 0.05, K.vest, 0, 0.6, -0.15));
  body.add(box(0.44, 0.34, 0.05, K.vest, 0, 0.6, 0.15));
  body.add(box(0.13, 0.1, 0.03, K.vestDark, -0.11, 0.56, -0.18));
  body.add(box(0.13, 0.1, 0.03, K.vestDark, 0.11, 0.56, -0.18));
  // Neck gaiter.
  body.add(box(0.3, 0.08, 0.26, K.gaiter, 0, 0.82, 0));

  // Head.
  const head = new THREE.Group();
  head.position.y = 1.03;
  // Chin up a touch so the shades and mustache show under the brim.
  head.rotation.x = 0.3;
  body.add(head);
  head.add(box(0.38, 0.36, 0.36, K.skin, 0, 0, 0));
  head.add(box(0.385, 0.13, 0.12, K.stubble, 0, -0.12, -0.13));
  head.add(box(0.2, 0.05, 0.04, K.stache, 0, -0.06, -0.195));
  head.add(box(0.06, 0.07, 0.05, K.skinDark, 0, 0.0, -0.2));
  head.add(box(0.36, 0.1, 0.02, K.frame, 0, 0.06, -0.188));
  head.add(box(0.14, 0.075, 0.03, K.shades, -0.085, 0.06, -0.195, false));
  head.add(box(0.14, 0.075, 0.03, K.shades, 0.085, 0.06, -0.195, false));
  head.add(box(0.04, 0.025, 0.035, '#ffffff', -0.115, 0.08, -0.2, false));
  head.add(box(0.02, 0.03, 0.2, K.frame, -0.19, 0.07, -0.08, false));
  head.add(box(0.02, 0.03, 0.2, K.frame, 0.19, 0.07, -0.08, false));
  head.add(box(0.05, 0.1, 0.08, K.skinDark, -0.2, 0, 0.0));
  head.add(box(0.05, 0.1, 0.08, K.skinDark, 0.2, 0, 0.0));
  head.add(box(0.39, 0.14, 0.06, K.hair, 0, 0.07, 0.17));
  // Cap.
  head.add(box(0.41, 0.13, 0.41, K.cap, 0, 0.23, 0.01));
  head.add(box(0.39, 0.035, 0.2, K.capDark, 0, 0.17, -0.27));
  head.add(box(0.06, 0.03, 0.06, K.capDark, 0, 0.31, 0.01, false));

  // Arms pivot at the shoulder.
  const arm = (sx: number) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.29, 0.75, 0);
    g.add(box(0.13, 0.34, 0.14, K.shirt, 0, -0.15, 0));
    g.add(box(0.12, 0.1, 0.12, K.skin, 0, -0.35, 0));
    body.add(g);
    return g;
  };
  const leftArm = arm(-1);
  const rightArm = arm(1);
  const hands = new THREE.Object3D();
  hands.position.set(0, 0.64, -0.46);
  body.add(hands);

  // Landing net slung on his back.
  const net = new THREE.Group();
  net.position.set(0.06, 0.62, 0.22);
  net.rotation.z = -0.35;
  net.add(box(0.05, 0.36, 0.05, K.net, 0, -0.18, 0));
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 4, 10), mat(K.net));
  hoop.position.y = 0.15;
  hoop.castShadow = true;
  net.add(hoop);
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshLambertMaterial({ color: '#2c2c2c', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  mesh.position.y = 0.15;
  net.add(mesh);
  body.add(net);

  // The rod: a lower and an upper section so it can bow under a fish.
  const rod = new THREE.Group();
  rod.position.set(0.3, 0.5, -0.24);
  rod.add(box(0.07, 0.26, 0.07, '#d8b07a', 0, 0.1, 0));
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 10), mat('#ff7a1a'));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0, 0.0, 0.07);
  reel.castShadow = true;
  rod.add(reel);
  rod.add(box(0.04, 1.1, 0.04, '#f4c430', 0, 0.55 + 0.2, 0));
  const rodUpper = new THREE.Group();
  rodUpper.position.y = 1.3;
  rodUpper.add(box(0.025, 1.1, 0.025, '#f4c430', 0, 0.55, 0));
  const rodTip = new THREE.Object3D();
  rodTip.position.y = 1.1;
  rodUpper.add(rodTip);
  rod.add(rodUpper);
  body.add(rod);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  // Chunky, so he reads from across the river.
  root.scale.setScalar(1.45);
  return { root, body, rightArm, leftArm, rod, rodUpper, rodTip, hands, legs };
}

export interface Bike {
  root: THREE.Group;
  wheels: THREE.Group[];
  legs: THREE.Group[];
}

const SHIRTS = ['#b83a3a', '#2f4f6f', '#e9e4d6', '#5b7c4a', '#d6923a', '#6c5b9b', '#3b3b3b', '#7fa7c9'];
const PANTS = ['#3f5b85', '#2d3a4f', '#b9a67e', '#5a5f4a', '#33302d'];
const CAPS = ['#2f4f6f', '#b83a3a', '#e9e4d6', '#3b3b3b', '#5b7c4a', '#d6923a'];
const HAIR = ['#3b2a1e', '#6b4a2e', '#c99a5b', '#1e1e1e', '#8a8a8a'];
const FRAMES = ['#d94f3d', '#2a6f97', '#f2a541', '#3c8d5a', '#e9e4d6', '#262626', '#8e6fd6'];
const SKINS = ['#f1c4a3', '#e8b796', '#c98e64', '#8d5a3b'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const shade = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

export const BIKE_WHEEL_R = 0.24;
export const BIKE_CRANK = { x: -0.02, y: 0.24, r: 0.09 };
export const BIKE_HIP = { x: -0.1, y: 0.7 };

/** A box from (x1, y1) to (x2, y2) in a side-on plane, `t` thick. */
function strut(parent: THREE.Object3D, x1: number, y1: number, x2: number, y2: number, t: number, color: string, z = 0) {
  const m = box(Math.hypot(x2 - x1, y2 - y1), t, t, color, (x1 + x2) / 2, (y1 + y2) / 2, z);
  m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  parent.add(m);
  return m;
}

/** Someone out on a hardtail in street clothes, riding toward +x with
    wheels on the ground at the origin. Each call rolls a new rider. */
export function buildBike(): Bike {
  const frame = pick(FRAMES);
  const shirt = pick(SHIRTS);
  const pants = pick(PANTS);
  const skin = pick(SKINS);
  const shorts = Math.random() < 0.5;
  const root = new THREE.Group();
  const bike = new THREE.Group();
  root.add(bike);

  // Open wheels: knobby tire, rim, spokes, hub, and a disc rotor. You can
  // see the trail through them.
  const R = BIKE_WHEEL_R;
  const wheels = [-0.36, 0.36].map((x) => {
    const w = new THREE.Group();
    w.position.set(x, R, 0);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R - 0.035, 0.035, 6, 28), mat('#2b2b2b'));
    w.add(tire);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const knob = box(0.035, 0.03, 0.075, '#222222', Math.cos(a) * (R - 0.005), Math.sin(a) * (R - 0.005), 0, false);
      knob.rotation.z = a;
      w.add(knob);
    }
    w.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.075, 0.012, 4, 24), mat('#3a3d42')));
    for (let k = 0; k < 4; k++) {
      const spoke = box(0.008, (R - 0.08) * 2, 0.008, '#c8ccd2', 0, 0, 0, false);
      spoke.rotation.z = (k / 4) * Math.PI + 0.2;
      w.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 8), mat('#2b2b2b'));
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.006, 12), mat('#c8ccd2'));
    rotor.rotation.x = Math.PI / 2;
    rotor.position.z = 0.04;
    w.add(rotor);
    bike.add(w);
    return w;
  });

  const C0 = BIKE_CRANK;
  strut(bike, C0.x, C0.y, 0.27, 0.58, 0.05, frame); // down tube
  strut(bike, -0.08, 0.6, 0.26, 0.66, 0.04, frame); // top tube, sloping
  strut(bike, C0.x, C0.y, -0.08, 0.62, 0.045, frame); // seat tube
  strut(bike, -0.36, R, C0.x, C0.y, 0.025, frame); // chain stay
  strut(bike, -0.36, R, -0.07, 0.58, 0.025, frame); // seat stay
  strut(bike, 0.27, 0.56, 0.25, 0.68, 0.055, frame); // head tube
  // Suspension fork: dark lowers, silver stanchions.
  strut(bike, 0.36, R, 0.31, 0.46, 0.045, '#2b2b2b');
  strut(bike, 0.31, 0.46, 0.27, 0.57, 0.03, '#d6d9de');
  strut(bike, -0.085, 0.62, BIKE_HIP.x, BIKE_HIP.y - 0.06, 0.03, '#2b2b2b'); // dropper
  bike.add(box(0.16, 0.04, 0.08, '#262626', BIKE_HIP.x + 0.01, BIKE_HIP.y - 0.04, 0)); // saddle
  strut(bike, 0.25, 0.68, 0.3, 0.72, 0.035, '#2b2b2b'); // stem
  bike.add(box(0.035, 0.03, 0.5, '#2b2b2b', 0.3, 0.73, 0)); // flat bar
  for (const z of [-0.22, 0.22]) bike.add(box(0.045, 0.045, 0.08, '#3a3a3a', 0.3, 0.73, z, false));
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.012, 14), mat('#3a3d42'));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(C0.x, C0.y, 0.045);
  bike.add(ring);

  // Rider, sitting fairly upright with hands out on the bar.
  const lean = -0.55;
  const torso = new THREE.Group();
  torso.position.set(BIKE_HIP.x, BIKE_HIP.y, 0);
  torso.rotation.z = lean;
  torso.add(box(0.17, 0.4, 0.27, shirt, 0, 0.2, 0));
  // A flannel check on some.
  if (Math.random() < 0.4) for (const y of [0.1, 0.24, 0.34]) torso.add(box(0.175, 0.025, 0.275, shade(shirt, 0.62), 0, y, 0, false));
  if (Math.random() < 0.3) torso.add(box(0.08, 0.26, 0.2, pick(CAPS), -0.12, 0.22, 0)); // day pack
  bike.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 0.5, 0);
  head.rotation.z = -lean;
  head.add(box(0.2, 0.2, 0.2, skin, 0, 0, 0));
  if (Math.random() < 0.6) {
    const cap = pick(CAPS);
    head.add(box(0.21, 0.08, 0.21, cap, -0.005, 0.1, 0));
    head.add(box(0.12, 0.02, 0.17, shade(cap, 0.8), 0.13, 0.065, 0));
  } else {
    const hair = pick(HAIR);
    head.add(box(0.21, 0.07, 0.21, hair, -0.01, 0.1, 0));
    head.add(box(0.06, 0.12, 0.21, hair, -0.08, 0.02, 0));
  }
  if (Math.random() < 0.25) head.add(box(0.06, 0.08, 0.2, pick(HAIR), 0.08, -0.07, 0)); // beard
  const shades = Math.random() < 0.6;
  head.add(box(0.025, shades ? 0.05 : 0.04, 0.18, shades ? '#1e1e1e' : '#5a3a22', 0.105, 0.025, 0, false));
  if (!shades) for (const z of [-0.045, 0.045]) head.add(box(0.012, 0.03, 0.06, '#cfe6ee', 0.112, 0.025, z, false));
  torso.add(head);

  // Arms from the shoulder to the grips, worked out in the torso's frame.
  const c = Math.cos(-lean);
  const sn = Math.sin(-lean);
  const gx = 0.3 - BIKE_HIP.x;
  const gy = 0.73 - BIKE_HIP.y;
  const hx = gx * c - gy * sn;
  const hy = gx * sn + gy * c;
  for (const z of [-0.13, 0.13]) {
    strut(torso, 0, 0.36, hx, hy, 0.07, shirt, z);
    torso.add(box(0.06, 0.06, 0.06, skin, hx, hy, z, false));
  }

  // Legs pivot at the hip; the game points them at the pedals each frame.
  // Shorts, or jeans, down to a pair of flat-pedal shoes.
  const legs = [0.08, -0.08].map((z) => {
    const g = new THREE.Group();
    g.position.set(BIKE_HIP.x, BIKE_HIP.y - 0.04, z);
    const leg = new THREE.Group();
    if (shorts) {
      leg.add(box(0.1, 0.48, 0.1, pants, 0, -0.24, 0));
      leg.add(box(0.075, 0.44, 0.075, skin, 0, -0.7, 0));
    } else leg.add(box(0.095, 0.92, 0.095, pants, 0, -0.46, 0));
    leg.add(box(0.14, 0.08, 0.09, '#2b2b2b', 0.02, -0.96, 0));
    g.add(leg);
    bike.add(g);
    return g;
  });

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  root.scale.setScalar(1.45);
  return { root, wheels, legs };
}

export type FlyId = 'adams' | 'bwo' | 'pmd' | 'caddis' | 'stimi' | 'hopper' | 'gnat';

/** A dry fly, tied on. Each has something bright on top to watch on the water.
    Built nose toward +x, floating at y 0. */
export function buildFly(id: FlyId = 'adams') {
  const g = new THREE.Group();
  const add = (w: number, h: number, d: number, c: string, x: number, y: number, z = 0) => g.add(box(w, h, d, c, x, y, z, false));
  const parachute = (body: string, tail: string, hackle: string, post: string, s = 1) => {
    add(0.11 * s, 0.03 * s, 0.03 * s, body, 0, 0);
    add(0.07 * s, 0.012, 0.03 * s, tail, -0.08 * s, 0.005);
    add(0.1 * s, 0.012, 0.1 * s, hackle, 0.02 * s, 0.025 * s);
    add(0.025 * s, 0.09 * s, 0.025 * s, post, 0.02 * s, 0.07 * s);
  };
  switch (id) {
    case 'adams':
      // Parachute Adams: gray body, brown tail, grizzly hackle round a white post.
      parachute('#8a8f96', '#7a5a3a', '#9b7650', '#ffffff');
      break;
    case 'bwo':
      parachute('#6f7a3c', '#8a8f96', '#8f949a', '#ffffff', 0.85);
      break;
    case 'pmd':
      parachute('#f0cf6a', '#d9b36a', '#e6c48a', '#ff8fb0', 0.92);
      break;
    case 'caddis':
      // Elk hair caddis: a tent of pale elk over a tan body, brown hackle palmered.
      add(0.12, 0.03, 0.03, '#a5824e', 0, 0);
      add(0.13, 0.03, 0.07, '#d8c39a', -0.01, 0.03);
      add(0.03, 0.05, 0.08, '#7a5a3a', 0.05, 0.02);
      break;
    case 'stimi':
      // Stimulator: big and orange, a stonefly in a hurry.
      add(0.16, 0.04, 0.045, '#ff8a2a', 0, 0);
      add(0.14, 0.025, 0.09, '#c9a46a', -0.03, 0.035);
      add(0.04, 0.06, 0.1, '#8a6a4a', 0.07, 0.025);
      add(0.04, 0.02, 0.05, '#ffd23f', 0.1, 0.01);
      break;
    case 'hopper':
      // Chernobyl hopper: layered foam, rubber legs, an orange sighter on top.
      add(0.2, 0.035, 0.07, '#c9a46a', 0, 0.01);
      add(0.2, 0.025, 0.07, '#2b2b2b', 0, 0.04);
      add(0.05, 0.03, 0.04, '#ff6a2a', 0.03, 0.065);
      for (const z of [-0.06, 0.06]) for (const x of [-0.04, 0.05]) add(0.012, 0.012, 0.07, '#5d6b2f', x, 0.01, z);
      break;
    case 'gnat':
      // Griffith's gnat: a speck of peacock and grizzly. Good luck seeing it.
      add(0.06, 0.025, 0.025, '#2f4a3a', 0, 0);
      add(0.07, 0.02, 0.06, '#8a8a8a', 0, 0.02);
      add(0.02, 0.03, 0.02, '#ffffff', 0.01, 0.045);
      break;
  }
  g.scale.setScalar(1.5);
  return g;
}

export type BugId = 'bwo' | 'pmd' | 'caddis' | 'stone' | 'hopper' | 'midge';

/** Naturals: the adults on the water and in the air. Built nose toward +x. */
export function buildBug(id: BugId) {
  const g = new THREE.Group();
  const wings = new THREE.Group();
  const add = (p: THREE.Object3D, w: number, h: number, d: number, c: string, x: number, y: number, z = 0) => p.add(box(w, h, d, c, x, y, z, false));
  switch (id) {
    case 'bwo':
    case 'pmd': {
      // A mayfly dun: curved body, two long tails, wings up like a sail.
      const body = id === 'bwo' ? '#6f7a3c' : '#f2d27a';
      const wing = id === 'bwo' ? '#7f8a96' : '#fff3c9';
      add(g, 0.1, 0.025, 0.025, body, 0, 0.01);
      add(g, 0.025, 0.035, 0.03, body, 0.06, 0.02);
      for (const z of [-0.012, 0.012]) add(g, 0.09, 0.006, 0.006, body, -0.09, 0.02, z);
      add(wings, 0.05, 0.09, 0.006, wing, 0.015, 0.07);
      break;
    }
    case 'caddis':
      add(g, 0.1, 0.025, 0.025, '#5a4a2e', 0, 0.01);
      add(wings, 0.12, 0.035, 0.05, '#b08a5a', -0.01, 0.035);
      for (const z of [-0.012, 0.012]) add(g, 0.1, 0.005, 0.005, '#5a4a2e', 0.1, 0.03, z);
      break;
    case 'stone':
      add(g, 0.18, 0.035, 0.04, '#f29a2e', 0, 0.01);
      add(g, 0.04, 0.03, 0.04, '#5a4a2e', 0.1, 0.015);
      add(wings, 0.2, 0.012, 0.07, '#8f8574', -0.02, 0.04);
      break;
    case 'hopper':
      add(g, 0.16, 0.05, 0.05, '#a7c43a', 0, 0.02);
      add(g, 0.05, 0.055, 0.05, '#c9b04a', 0.09, 0.03);
      for (const z of [-0.035, 0.035]) {
        const leg = box(0.13, 0.02, 0.02, '#8aa02e', -0.03, 0.04, z, false);
        leg.rotation.z = 0.45;
        g.add(leg);
      }
      add(wings, 0.12, 0.012, 0.05, '#8a6a3a', -0.02, 0.05);
      break;
    case 'midge':
      add(g, 0.05, 0.015, 0.015, '#2b2b2b', 0, 0.01);
      add(wings, 0.04, 0.004, 0.05, '#cfd8dc', 0, 0.022);
      break;
  }
  g.add(wings);
  g.scale.setScalar(1.6);
  return { root: g, wings };
}

export type NymphId = 'olive' | 'pale' | 'caddis' | 'stone' | 'midge';

export interface UnderRock {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  tick: (t: number, dt: number) => void;
}

/** The underside of a stone, turned over in a wet hand: algae, grit, and
    whatever was hiding there, crawling for cover. A scene of its own. */
export function buildUnderRock(bugs: NymphId[]): UnderRock {
  const rand = rng(Math.floor(Math.random() * 1e6));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#33494c');
  scene.add(new THREE.HemisphereLight('#f4fbff', '#3b4a3a', 1.6));
  const key = new THREE.DirectionalLight('#fff4e0', 2.2);
  key.position.set(-2, 5, 3);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(32, 1.4, 0.1, 30);
  camera.position.set(0, 5.6, 3.1);
  camera.lookAt(0, 0, 0.1);

  const rock = lump('#6f665a', 2.6, 0.5, 1.9, rand() * 9);
  scene.add(rock);
  // Algae and silt, then grit stuck to it.
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 1.5;
    const m = lump(rand() < 0.6 ? '#5f7a3a' : '#8a7d5a', 0.3 + rand() * 0.4, 0.05, 0.25 + rand() * 0.3, rand() * 9, 0);
    m.position.set(Math.cos(a) * r, 0.47 - r * r * 0.05, Math.sin(a) * r * 0.75);
    scene.add(m);
  }
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 1.9;
    const s = 0.02 + rand() * 0.04;
    scene.add(box(s, s, s, pickRand(C.stones, rand), Math.cos(a) * r, 0.5 - r * r * 0.06, Math.sin(a) * r * 0.75, false));
  }

  const crawlers = bugs.map((id) => {
    const n = nymph(id, rand);
    const a = rand() * Math.PI * 2;
    const r = 0.3 + rand() * 0.9;
    n.root.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r * 0.7);
    n.root.rotation.y = rand() * Math.PI * 2;
    scene.add(n.root);
    return { ...n, id, heading: n.root.rotation.y, speed: id === 'caddis' ? 0.04 : id === 'stone' ? 0.16 : 0.12, seed: rand() * 9 };
  });

  const tick = (t: number, dt: number) => {
    for (const c of crawlers) {
      // Wander, then turn back toward the middle before falling off the edge.
      const p = c.root.position;
      const r = Math.hypot(p.x / 1.9, p.z / 1.3);
      c.heading += (Math.sin(t * 0.9 + c.seed) * 0.8 + (r > 0.8 ? 2.4 : 0)) * dt;
      if (r > 0.8) c.heading = lerpTo(c.heading, Math.atan2(p.z, -p.x), dt * 1.5);
      const go = c.speed * (0.6 + 0.4 * Math.sin(t * 2.3 + c.seed));
      p.x += Math.cos(c.heading) * go * dt;
      p.z -= Math.sin(c.heading) * go * dt;
      p.y = 0.49 - (p.x * p.x + p.z * p.z) * 0.035;
      c.root.rotation.y = c.heading;
      c.legs.forEach((l, i) => (l.rotation.y = Math.sin(t * 12 + i * 1.7) * 0.35));
      c.bend.forEach((b, i) => (b.rotation.y = Math.sin(t * (c.id === 'midge' ? 7 : 3) + i) * (c.id === 'midge' ? 0.5 : 0.12)));
    }
  };
  return { scene, camera, tick };
}

const pickRand = <T,>(a: T[], rand: () => number) => a[Math.floor(rand() * a.length)];
const lerpTo = (a: number, b: number, k: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
};

/** Nymphs and larvae, about half a unit long, nose toward +x. */
function nymph(id: NymphId, rand: () => number) {
  const root = new THREE.Group();
  const legs: THREE.Object3D[] = [];
  const bend: THREE.Object3D[] = [];
  const add = (p: THREE.Object3D, w: number, h: number, d: number, c: string, x: number, y: number, z = 0) => {
    const m = box(w, h, d, c, x, y, z);
    p.add(m);
    return m;
  };
  const legsAt = (xs: number[], half: number, len: number, c: string, t: number) => {
    for (const x of xs) {
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(x, 0.02, s * half);
        const l = add(g, t, t, len, c, 0, 0, s * len / 2);
        l.rotation.x = s * 0.25;
        root.add(g);
        legs.push(g);
      }
    }
  };
  if (id === 'olive' || id === 'pale') {
    // Mayfly nymph: flat, gills feathering the abdomen, three tails, dark wing pads.
    const c = id === 'olive' ? '#5f6a32' : '#a8875a';
    const dark = id === 'olive' ? '#3e4622' : '#7a5c38';
    add(root, 0.1, 0.06, 0.12, c, 0.17, 0.03);
    add(root, 0.13, 0.07, 0.16, c, 0.06, 0.035);
    add(root, 0.1, 0.03, 0.15, dark, 0.05, 0.075);
    const tail = new THREE.Group();
    tail.position.x = -0.01;
    root.add(tail);
    bend.push(tail);
    for (let k = 0; k < 4; k++) {
      add(tail, 0.06, 0.05, 0.13 - k * 0.02, c, -0.04 - k * 0.055, 0.03);
      for (const s of [-1, 1]) add(tail, 0.03, 0.01, 0.04, '#d9d2b8', -0.04 - k * 0.055, 0.04, s * (0.075 - k * 0.01));
    }
    for (const a of [-0.35, 0, 0.35]) {
      const t = add(tail, 0.22, 0.01, 0.01, dark, -0.33, 0.03, 0);
      t.rotation.y = a;
      t.position.z = Math.sin(a) * 0.1;
    }
    legsAt([0.13, 0.07, 0.01], 0.08, 0.12, dark, 0.018);
  } else if (id === 'stone') {
    // Golden stone nymph: big, armored, two tails and two feelers.
    const c = '#b8873a';
    const dark = '#6b4a22';
    add(root, 0.12, 0.07, 0.13, c, 0.3, 0.035);
    add(root, 0.12, 0.07, 0.18, c, 0.17, 0.04);
    add(root, 0.12, 0.07, 0.2, c, 0.04, 0.04);
    for (const x of [0.17, 0.04]) add(root, 0.08, 0.02, 0.2, dark, x, 0.08);
    const tail = new THREE.Group();
    root.add(tail);
    bend.push(tail);
    for (let k = 0; k < 4; k++) {
      add(tail, 0.08, 0.06, 0.17 - k * 0.025, k % 2 ? dark : c, -0.07 - k * 0.075, 0.035);
    }
    for (const s of [-1, 1]) {
      const t = add(tail, 0.26, 0.012, 0.012, dark, -0.48, 0.03, s * 0.05);
      t.rotation.y = s * 0.3;
      const f = add(root, 0.26, 0.01, 0.01, dark, 0.48, 0.04, s * 0.05);
      f.rotation.y = -s * 0.4;
    }
    legsAt([0.22, 0.1, -0.02], 0.1, 0.18, dark, 0.025);
  } else if (id === 'caddis') {
    // Cased caddis: a tube of glued grit with the larva's head poking out.
    const tube = new THREE.Group();
    root.add(tube);
    for (let k = 0; k < 9; k++) {
      const s = 0.06 + rand() * 0.03;
      for (const [dy, dz] of [[0.05, 0], [0, 0.05], [0, -0.05], [-0.02, 0]] as const) {
        const m = add(tube, s, s, s, pickRand(C.stones, rand), -k * 0.05, 0.05 + dy, dz);
        m.rotation.set(rand(), rand(), rand());
      }
    }
    add(root, 0.06, 0.05, 0.06, '#e8dcb8', 0.05, 0.05);
    add(root, 0.04, 0.04, 0.05, '#4a3a22', 0.09, 0.05);
    legsAt([0.06, 0.04], 0.03, 0.06, '#4a3a22', 0.012);
  } else {
    // Midge larva: a thin red worm, all wriggle.
    let parent: THREE.Object3D = root;
    for (let k = 0; k < 7; k++) {
      const g = new THREE.Group();
      g.position.x = k ? -0.05 : 0.1;
      parent.add(g);
      add(g, 0.055, 0.03, 0.03, k % 2 ? '#b8323a' : '#cf4a4a', -0.025, 0.02);
      bend.push(g);
      parent = g;
    }
  }
  root.scale.setScalar(id === 'midge' ? 2 : 1.6);
  return { root, legs, bend };
}
